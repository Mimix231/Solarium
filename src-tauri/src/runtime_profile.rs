//! Measured local hardware and GGUF metadata. Estimates are labelled; loading is still verified by the server.
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs,
    io::{Read, Seek, SeekFrom},
    path::Path,
    process::Command,
};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Hardware {
    pub gpu_name: Option<String>,
    pub gpu_total_bytes: u64,
    pub gpu_free_bytes: u64,
    pub ram_available_bytes: Option<u64>,
    pub cpu: String,
}
pub fn hardware() -> Hardware {
    let mut command = Command::new("nvidia-smi");
    command.args([
        "--query-gpu=name,memory.total,memory.free",
        "--format=csv,noheader,nounits",
    ]);
    crate::project_commands::clean_environment(&mut command);
    let gpu = command
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .and_then(|s| s.lines().next().map(str::to_owned));
    let fields: Vec<String> = gpu
        .as_deref()
        .unwrap_or("")
        .split(',')
        .map(|s| s.trim().to_owned())
        .collect();
    let mut result = Hardware {
        gpu_name: fields.first().filter(|s| !s.is_empty()).cloned(),
        gpu_total_bytes: fields
            .get(1)
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0)
            * 1024
            * 1024,
        gpu_free_bytes: fields
            .get(2)
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0)
            * 1024
            * 1024,
        ram_available_bytes: None,
        cpu: std::env::consts::ARCH.into(),
    };
    #[cfg(windows)]
    {
        let mut command = Command::new("powershell.exe");
        command.args(["-NoProfile","-NonInteractive","-Command","$os=Get-CimInstance Win32_OperatingSystem; $cpu=Get-CimInstance Win32_Processor | Select-Object -First 1; @{ram=[uint64]$os.FreePhysicalMemory*1024;cpu=$cpu.Name} | ConvertTo-Json -Compress"]);
        crate::project_commands::clean_environment(&mut command);
        if let Some(value) = command
            .output()
            .ok()
            .filter(|o| o.status.success())
            .and_then(|o| serde_json::from_slice::<serde_json::Value>(&o.stdout).ok())
        {
            result.ram_available_bytes = value["ram"].as_u64();
            result.cpu = value["cpu"]
                .as_str()
                .unwrap_or(std::env::consts::ARCH)
                .into();
        }
    }
    #[cfg(target_os = "linux")]
    {
        if let Ok(info) = fs::read_to_string("/proc/meminfo") {
            result.ram_available_bytes = info
                .lines()
                .find(|s| s.starts_with("MemAvailable:"))
                .and_then(|s| s.split_whitespace().nth(1))
                .and_then(|n| n.parse::<u64>().ok())
                .map(|n| n * 1024);
        }
    }
    result
}
fn integer<const N: usize>(file: &mut fs::File) -> Result<[u8; N], String> {
    let mut bytes = [0; N];
    file.read_exact(&mut bytes).map_err(|e| e.to_string())?;
    Ok(bytes)
}
fn string(file: &mut fs::File, retain: bool) -> Result<String, String> {
    let length = u64::from_le_bytes(integer(file)?);
    if length > 16_000_000 {
        return Err("Invalid GGUF string length".into());
    }
    if retain {
        let mut data = vec![0; length as usize];
        file.read_exact(&mut data).map_err(|e| e.to_string())?;
        String::from_utf8(data).map_err(|e| e.to_string())
    } else {
        file.seek(SeekFrom::Current(length as i64))
            .map_err(|e| e.to_string())?;
        Ok(String::new())
    }
}
fn value(
    file: &mut fs::File,
    kind: u32,
    retain: bool,
    depth: u8,
) -> Result<Option<serde_json::Value>, String> {
    if depth > 8 {
        return Err("GGUF metadata is too deeply nested".into());
    }
    let number = match kind {
        0 | 1 | 7 => Some(u8::from_le_bytes(integer(file)?) as f64),
        2 | 3 => Some(u16::from_le_bytes(integer(file)?) as f64),
        4 | 5 => Some(u32::from_le_bytes(integer(file)?) as f64),
        6 => Some(f32::from_le_bytes(integer(file)?) as f64),
        10 | 11 => Some(u64::from_le_bytes(integer(file)?) as f64),
        12 => Some(f64::from_le_bytes(integer(file)?)),
        8 => {
            return Ok(if retain {
                Some(string(file, true)?.into())
            } else {
                string(file, false)?;
                None
            })
        }
        9 => {
            let item = u32::from_le_bytes(integer(file)?);
            let count = u64::from_le_bytes(integer(file)?);
            if count > 2_000_000 {
                return Err("GGUF metadata array exceeds supported length".into());
            }
            for _ in 0..count {
                value(file, item, false, depth + 1)?;
            }
            None
        }
        _ => return Err("Unknown GGUF metadata type".into()),
    };
    Ok(if retain {
        number
            .and_then(serde_json::Number::from_f64)
            .map(Into::into)
    } else {
        None
    })
}
pub fn metadata(path: &Path) -> Result<BTreeMap<String, serde_json::Value>, String> {
    let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
    if &integer::<4>(&mut file)? != b"GGUF" {
        return Err("This file is not GGUF".into());
    }
    let version = u32::from_le_bytes(integer(&mut file)?);
    if !(2..=3).contains(&version) {
        return Err("Unsupported GGUF version".into());
    }
    let _tensors = u64::from_le_bytes(integer(&mut file)?);
    let count = u64::from_le_bytes(integer(&mut file)?);
    if count > 100_000 {
        return Err("GGUF metadata count exceeds supported length".into());
    }
    let mut values = BTreeMap::new();
    for _ in 0..count {
        let key = string(&mut file, true)?;
        let kind = u32::from_le_bytes(integer(&mut file)?);
        let keep = key == "general.architecture"
            || [
                ".block_count",
                ".embedding_length",
                ".attention.head_count",
                ".attention.head_count_kv",
                ".attention.key_length",
                ".attention.value_length",
                ".context_length",
            ]
            .iter()
            .any(|suffix| key.ends_with(suffix));
        if let Some(value) = value(&mut file, kind, keep, 0)? {
            values.insert(key, value);
        }
        if file.stream_position().map_err(|e| e.to_string())? > 64_000_000 {
            return Err("GGUF metadata exceeds 64 MB".into());
        }
    }
    Ok(values)
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadPlan {
    pub model_path: String,
    pub file_signature: String,
    pub architecture: String,
    pub blocks: u32,
    pub weight_bytes: u64,
    pub context_size: u32,
    pub recommended_gpu_layers: i32,
    pub estimated_gpu_bytes: u64,
    pub currently_loaded: bool,
    pub hardware: Hardware,
    pub warnings: Vec<String>,
}
pub fn choose_layers(weight_bytes: u64, blocks: u32, kv_bytes: u64, free: u64, total: u64) -> i32 {
    if blocks == 0 || total == 0 {
        return 0;
    }
    let reserve = (total / 8).max(768 * 1024 * 1024);
    let budget = free.saturating_sub(reserve) * 9 / 10;
    let layer_bytes = (weight_bytes + kv_bytes) / (blocks as u64 + 1);
    if layer_bytes == 0 {
        return 0;
    }
    let count = (budget / layer_bytes).min(blocks as u64 + 1);
    if count > blocks as u64 {
        -1
    } else {
        count as i32
    }
}
pub fn plan(gguf: &str, context: u32, resident: Option<i32>) -> Result<LoadPlan, String> {
    if !(256..=262144).contains(&context) {
        return Err("Choose a supported input context size".into());
    }
    let path = Path::new(gguf).canonicalize().map_err(|e| e.to_string())?;
    let stat = path.metadata().map_err(|e| e.to_string())?;
    let values = metadata(&path)?;
    let arch = values
        .get("general.architecture")
        .and_then(|v| v.as_str())
        .ok_or("GGUF architecture metadata is missing")?;
    let get = |suffix: &str| {
        values
            .get(&format!("{arch}.{suffix}"))
            .and_then(|v| v.as_f64())
            .map(|n| n as u64)
    };
    let blocks = get("block_count")
        .filter(|n| *n > 0 && *n < 1000)
        .ok_or("GGUF layer count is unavailable; use explicit manual runtime settings")?
        as u32;
    let heads = get("attention.head_count").unwrap_or(1).max(1);
    let kv_heads = get("attention.head_count_kv").unwrap_or(heads);
    let dim = get("embedding_length").unwrap_or(4096) / heads;
    let kv = context as u64
        * blocks as u64
        * kv_heads
        * (get("attention.key_length").unwrap_or(dim)
            + get("attention.value_length").unwrap_or(dim))
        * 2;
    let measured = hardware();
    let layers = resident.unwrap_or_else(|| {
        choose_layers(
            stat.len(),
            blocks,
            kv,
            measured.gpu_free_bytes,
            measured.gpu_total_bytes,
        )
    });
    let gpu_count = if layers < 0 {
        blocks + 1
    } else {
        layers as u32
    };
    let estimated = (stat.len() + kv) / (blocks as u64 + 1) * gpu_count as u64;
    let mut file = fs::File::open(&path).map_err(|e| e.to_string())?;
    let mut sample = vec![0; 65536.min(stat.len() as usize)];
    file.read_exact(&mut sample).map_err(|e| e.to_string())?;
    let mut hash = Sha256::new();
    hash.update(&sample);
    hash.update(stat.len().to_le_bytes());
    hash.update(format!("{:?}", stat.modified().ok()));
    let signature = format!("{:x}", hash.finalize());
    let mut warnings=vec!["GPU/KV allocation is an estimate from GGUF metadata and measured free memory; actual server loading and tool behaviour must be checked.".into()];
    if let Some(ram) = measured.ram_available_bytes {
        if stat
            .len()
            .saturating_sub(stat.len() / (blocks as u64 + 1) * gpu_count as u64)
            > ram * 9 / 10
        {
            warnings.push("The remaining model weights may exceed available system RAM.".into());
        }
    }
    Ok(LoadPlan {
        model_path: path.to_string_lossy().into_owned(),
        file_signature: signature,
        architecture: arch.into(),
        blocks,
        weight_bytes: stat.len(),
        context_size: context,
        recommended_gpu_layers: layers,
        estimated_gpu_bytes: estimated,
        currently_loaded: resident.is_some(),
        hardware: measured,
        warnings,
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn measured_budget_keeps_headroom_and_handles_cpu() {
        let gb = 1024 * 1024 * 1024;
        assert_eq!(choose_layers(5 * gb, 32, gb, 11 * gb, 12 * gb), -1);
        let layers = choose_layers(18 * gb, 48, 2 * gb, 10 * gb, 12 * gb);
        assert!(layers > 0 && layers < 48);
        assert_eq!(choose_layers(5 * gb, 32, gb, 0, 0), 0);
        assert_eq!(choose_layers(5 * gb, 32, gb, 512 * 1024 * 1024, 12 * gb), 0);
    }
}
