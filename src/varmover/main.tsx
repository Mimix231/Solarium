import { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { isRunningInsideTauri, parseProjectContents, readPackagedPlayerProject } from "./editor/projectFile";
import { useEditorStore } from "./editor/store";
import "./styles.css";

function ShadowiumRoot() {
  const [ready, setReady] = useState(false);
  const [packagedPlayer, setPackagedPlayer] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void readPackagedPlayerProject()
      .then((contents) => {
        if (cancelled || !contents) return;
        const project = parseProjectContents(contents);
        const store = useEditorStore.getState();
        store.replaceProject(project, null, null);
        store.setPlayState("playing");
        document.title = project.metadata.name;
        if (isRunningInsideTauri()) {
          void getCurrentWindow().setTitle(project.metadata.name).catch(() => undefined);
        }
        setPackagedPlayer(true);
      })
      .catch((error: unknown) => console.error("Could not launch packaged Shadowium game", error))
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);

  if (!ready) return <div className="shadowium-launch-screen"><strong>Shadowium Runtime</strong><span>Loading game package…</span></div>;
  return <App packagedPlayer={packagedPlayer} />;
}

const root = document.getElementById("root");
if (!root) throw new Error("ShadowiumUI could not find the root element.");
ReactDOM.createRoot(root).render(<ShadowiumRoot />);
