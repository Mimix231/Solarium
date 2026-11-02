from __future__ import annotations
from pathlib import Path
import os,subprocess

def git_status(root:Path)->dict:
    root=root.resolve()
    def run(args,timeout=5):
        return subprocess.run(['git',*args],cwd=root,capture_output=True,timeout=timeout,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
    try:
        top=run(['rev-parse','--show-toplevel'])
        if top.returncode!=0:return {'repository':False,'files':[]}
        repo=Path(os.fsdecode(top.stdout).strip()).resolve()
        branch=os.fsdecode(run(['branch','--show-current']).stdout).strip() or None
        status=run(['-c','core.quotepath=false','status','--porcelain=v1','-z','--untracked-files=normal','--','.'],10)
        if status.returncode:raise RuntimeError(os.fsdecode(status.stderr))
        entries=status.stdout.split(b'\0');files=[];index=0
        while index<len(entries):
            line=entries[index];index+=1
            if len(line)<4:continue
            xy=line[:2].decode('ascii');path=os.fsdecode(line[3:])
            if 'R' in xy or 'C' in xy:index+=1
            full=(repo/path).resolve()
            if not full.is_relative_to(root):continue
            relative=full.relative_to(root).as_posix()
            if relative=='.solarium-trash' or relative.startswith('.solarium-trash/'):continue
            files.append({'path':relative,'indexStatus':xy[0],'worktreeStatus':xy[1]})
        return {'repository':True,'root':str(repo),'branch':branch,'files':files}
    except Exception as exc:return {'repository':False,'files':[],'error':str(exc)}
