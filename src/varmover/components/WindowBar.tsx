import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";
import shadowiumIcon from "../assets/shadowiumui-icon.png";
import { isRunningInsideTauri } from "../editor/projectFile";
import { useEditorStore } from "../editor/store";

export function WindowBar() {
  const projectName = useEditorStore((state) => state.project.metadata.name);
  const isDirty = useEditorStore((state) => state.isDirty);
  const [isMaximized, setIsMaximized] = useState(false);
  const allowCloseRef = useRef(false);
  const tauri = isRunningInsideTauri();

  async function terminateApplication(): Promise<void> {
    if (!tauri) {
      window.close();
      return;
    }

    try {
      await invoke("close_application");
    } catch {
      // Keep a direct window-destruction fallback for browser-dev builds or an
      // older backend while still preferring the process-level exit command.
      await getCurrentWindow().destroy();
    }
  }

  useEffect(() => {
    if (!tauri) return;

    const windowHandle = getCurrentWindow();
    let unlistenResize: (() => void) | undefined;
    let unlistenClose: (() => void) | undefined;

    void windowHandle.isMaximized().then(setIsMaximized).catch(() => undefined);
    void windowHandle.setTitle(`${projectName}${isDirty ? " •" : ""} — ShadowiumUI`).catch(() => undefined);

    void windowHandle
      .onResized(async () => {
        setIsMaximized(await windowHandle.isMaximized());
      })
      .then((dispose) => {
        unlistenResize = dispose;
      });

    void windowHandle
      .onCloseRequested((event) => {
        if (!isDirty || allowCloseRef.current) return;

        event.preventDefault();
        const confirmed = window.confirm(
          "ShadowiumUI has unsaved changes. Close the editor and discard them?",
        );

        if (confirmed) {
          allowCloseRef.current = true;
          void terminateApplication();
        }
      })
      .then((dispose) => {
        unlistenClose = dispose;
      });

    return () => {
      unlistenResize?.();
      unlistenClose?.();
    };
  }, [tauri, isDirty, projectName]);

  async function minimize(): Promise<void> {
    if (tauri) await getCurrentWindow().minimize();
  }

  async function toggleMaximize(): Promise<void> {
    if (!tauri) return;
    const windowHandle = getCurrentWindow();
    await windowHandle.toggleMaximize();
    setIsMaximized(await windowHandle.isMaximized());
  }

  async function close(): Promise<void> {
    if (isDirty && !window.confirm("ShadowiumUI has unsaved changes. Close the editor and discard them?")) return;
    allowCloseRef.current = true;
    await terminateApplication();
  }

  return (
    <header
      className="window-bar"
      data-tauri-drag-region
      onDoubleClick={() => void toggleMaximize()}
    >
      <div className="window-brand" data-tauri-drag-region>
        <span className="window-brand-icon"><img src={shadowiumIcon} alt="" /></span>
        <strong data-tauri-drag-region>{projectName}{isDirty ? " •" : ""}</strong>
        <span className="window-document" data-tauri-drag-region>ShadowiumUI</span>
      </div>

      <div className="window-controls" onDoubleClick={(event) => event.stopPropagation()}>
        <button type="button" aria-label="Minimize" onClick={() => void minimize()}>
          <Minus size={16} />
        </button>
        <button type="button" aria-label={isMaximized ? "Restore" : "Maximize"} onClick={() => void toggleMaximize()}>
          {isMaximized ? <Copy size={12} /> : <Square size={13} />}
        </button>
        <button className="window-close" type="button" aria-label="Close" onClick={() => void close()}>
          <X size={16} />
        </button>
      </div>
    </header>
  );
}
