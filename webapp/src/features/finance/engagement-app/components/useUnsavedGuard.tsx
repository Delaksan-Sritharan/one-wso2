// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import EaDialog from "./EaDialog";

/**
 * Guards a form with edits in it. A reload or a closed tab asks the browser to confirm, and a click on any link of the app,
 * or `leave(path)` from the form's own Cancel, asks `prompt` first. (The app's router cannot block the browser's back button.)
 * Render `prompt` anywhere in the page.
 */
export function useUnsavedGuard(dirty: boolean): { prompt: ReactNode; leave: (to: string) => void } {
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState<string | null>(null);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(a instanceof HTMLAnchorElement) || a.target === "_blank" || a.origin !== window.location.origin) return;
      const to = a.pathname + a.search + a.hash;
      if (to === window.location.pathname + window.location.search + window.location.hash) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaving(to);
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);
  const prompt = leaving ? (
    <EaDialog
      title="Discard Changes"
      confirmLabel="Discard"
      cancelLabel="Keep Editing"
      confirmColor="error"
      maxWidth="xs"
      onConfirm={() => {
        const to = leaving;
        setLeaving(null);
        navigate(to);
      }}
      onClose={() => setLeaving(null)}
    >
      You have changes that are not saved. Discard them and leave this page?
    </EaDialog>
  ) : null;
  return { prompt, leave: (to) => (dirty ? setLeaving(to) : navigate(to)) };
}
