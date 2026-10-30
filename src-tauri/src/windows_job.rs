//! Windows Job Objects: managed llama-server processes are killed when Solarium's
//! last job handle closes (including an unexpected Solarium process exit).
//! Windows-only, no additional runtime DLL or external executable is required.
#![cfg(windows)]
use std::ffi::c_void;
use std::os::windows::io::AsRawHandle;
use std::process::Child;

#[repr(C)]
#[derive(Default)]
struct BasicLimits {
    per_process_user_time_limit: i64,
    per_job_user_time_limit: i64,
    limit_flags: u32,
    minimum_working_set_size: usize,
    maximum_working_set_size: usize,
    active_process_limit: u32,
    affinity: usize,
    priority_class: u32,
    scheduling_class: u32,
}
#[repr(C)]
#[derive(Default)]
struct IoCounters { read_operation_count: u64, write_operation_count: u64, other_operation_count: u64,
    read_transfer_count: u64, write_transfer_count: u64, other_transfer_count: u64 }
#[repr(C)]
#[derive(Default)]
struct ExtendedLimits { basic: BasicLimits, io: IoCounters,
    process_memory_limit: usize, job_memory_limit: usize,
    peak_process_memory_used: usize, peak_job_memory_used: usize }

#[link(name = "kernel32")]
extern "system" {
    fn CreateJobObjectW(attributes: *const c_void, name: *const u16) -> *mut c_void;
    fn SetInformationJobObject(job: *mut c_void, class: u32, info: *const c_void, length: u32) -> i32;
    fn AssignProcessToJobObject(job: *mut c_void, process: *mut c_void) -> i32;
    fn CloseHandle(handle: *mut c_void) -> i32;
}

pub struct JobObject { handle: *mut c_void }
unsafe impl Send for JobObject {}
unsafe impl Sync for JobObject {}
impl JobObject {
    pub fn create() -> Result<Self, String> {
        let handle = unsafe { CreateJobObjectW(std::ptr::null(), std::ptr::null()) };
        if handle.is_null() { return Err(format!("CreateJobObject failed: {}", std::io::Error::last_os_error())); }
        let mut settings = ExtendedLimits::default();
        settings.basic.limit_flags = 0x0000_2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        let ok = unsafe { SetInformationJobObject(handle, 9, &settings as *const _ as *const c_void, std::mem::size_of::<ExtendedLimits>() as u32) };
        if ok == 0 {
            let error = std::io::Error::last_os_error();
            unsafe { CloseHandle(handle); }
            return Err(format!("SetInformationJobObject failed: {error}"));
        }
        Ok(Self { handle })
    }
    pub fn attach(&self, process: &Child) -> Result<(), String> {
        let ok = unsafe { AssignProcessToJobObject(self.handle, process.as_raw_handle() as *mut c_void) };
        if ok == 0 { return Err(format!("AssignProcessToJobObject failed: {}", std::io::Error::last_os_error())); }
        Ok(())
    }
}
impl Drop for JobObject { fn drop(&mut self) { unsafe { CloseHandle(self.handle); } } }
