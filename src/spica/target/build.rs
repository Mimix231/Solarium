fn main() {
    println!("cargo:rerun-if-changed=../src/plan.json");
    println!("cargo:rerun-if-changed=../dist");
    let path = std::path::Path::new("icons/icon.ico");
    if !path.exists() {
        // A self-contained 16×16 BGRA icon for the generated Windows executable.
        let mut icon = vec![0, 0, 1, 0, 1, 0, 16, 16, 0, 0, 1, 0, 32, 0];
        icon.extend_from_slice(&1128u32.to_le_bytes());
        icon.extend_from_slice(&22u32.to_le_bytes());
        for field in [40u32, 16, 32, 0x00200001, 0, 1024, 0, 0, 0, 0] {
            icon.extend_from_slice(&field.to_le_bytes());
        }
        for y in 0i32..16 {
            for x in 0i32..16 {
                let diamond = (x - 7).abs() + (y - 7).abs() <= 6;
                icon.extend_from_slice(if diamond { &[246, 208, 141, 255] } else { &[116, 63, 42, 255] });
            }
        }
        icon.extend_from_slice(&[0; 64]);
        std::fs::create_dir_all("icons").expect("create Windows icon directory");
        std::fs::write(path, icon).expect("write Windows icon");
    }
    tauri_build::build();
}
