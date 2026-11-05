import { isNativeApp } from "@/lib/platform";

/**
 * Hands the person a file they asked for. On a phone or in the installed app (touch
 * devices that can share files) it opens the share sheet, which is the reliable way to get
 * a file out of a WebView; on a computer it is an ordinary download, because a desktop
 * browser would otherwise open the operating system's share sheet instead of saving the file. Returns "shared" or "downloaded". Dismissing the share sheet
 * throws an AbortError, which callers should treat as "changed my mind".
 */
export async function saveFile(filename: string, contents: string, mime: string, shareTitle: string): Promise<"shared" | "downloaded"> {
  const file = new File([contents], filename, { type: mime });
  const touchDevice = isNativeApp() || window.matchMedia?.("(pointer: coarse)").matches;
  if (touchDevice && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: shareTitle });
    return "shared";
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}
