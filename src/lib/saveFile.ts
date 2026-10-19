/**
 * Hands the person a file they asked for. Where the browser can share files
 * (phones, including the installed app) it opens the share sheet, which is the
 * reliable way to get a file out of a WebView; elsewhere it's an ordinary
 * download. Returns "shared" or "downloaded". Dismissing the share sheet
 * throws an AbortError, which callers should treat as "changed my mind".
 */
export async function saveFile(filename: string, contents: string, mime: string, shareTitle: string): Promise<"shared" | "downloaded"> {
  const file = new File([contents], filename, { type: mime });
  if (navigator.canShare?.({ files: [file] })) {
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
