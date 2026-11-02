"use client";
import * as monaco from "monaco-editor/editor/editor.api";
import "monaco-editor/basic-languages/monaco.contribution";
import { loader } from "@monaco-editor/react";

// All editor/sanitizer code is bundled locally. Passing the installed instance
// bypasses the wrapper's default CDN/AMD loader and its embedded old sanitizer.
self.MonacoEnvironment = {
  getWorker() {
    return new Worker(
      new URL("monaco-editor/editor/editor.worker.js", import.meta.url),
      { type: "module" },
    );
  },
};
loader.config({ monaco });
