import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { TrackedAffiliateSiteConfig } from "./trackedAffiliateObfuscation";

export function trackrAttributionModulePath(): string {
  return fileURLToPath(import.meta.resolve("trackr-attribution/browser"));
}

function generatedRuntimeSource(config: TrackedAffiliateSiteConfig): string {
  const id = config.identifiers;
  const helper = (name: string): string => `${id.selector}${name}`;
  const attributionModule = trackrAttributionModulePath();
  return `import { initTrackrAttribution as ${id.attribution}Init } from ${JSON.stringify(attributionModule)};
const ${id.selector}=${JSON.stringify(`[${config.controlAttribute}]`)};
const ${helper("inner")}="a[href],button,input,select,textarea,summary,[contenteditable='true'],[role='button'],[role='link']";
const ${helper("prefix")}=${JSON.stringify(config.payloadPrefix)};
const ${helper("variant")}=${JSON.stringify(config.variant)};
const ${helper("xor")}=${config.xorKey};
const ${helper("entry")}=${id.attribution}Init({trackerURLs:[location.origin],decorateLinks:false});${helper("entry")}.stop();
function ${helper("b64")}(bytes){let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"")}
function ${id.decode}(payload){if(typeof payload!=="string"||payload.length>4096||!payload.startsWith(${helper("prefix")}))return null;const encoded=payload.slice(${helper("prefix")}.length);if(!/^[A-Za-z0-9_-]+$/.test(encoded)||encoded.length%4===1)return null;let binary;try{binary=atob(encoded.replaceAll("-","+").replaceAll("_","/"))}catch{return null}const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));if(${helper("b64")}(bytes)!==encoded)return null;if(${helper("variant")}==="xor-base64url")for(let index=0;index<bytes.length;index++)bytes[index]^=${helper("xor")};else if(${helper("variant")}==="reverse-base64url")bytes.reverse();let clear;try{clear=new TextDecoder("utf-8",{fatal:true}).decode(bytes)}catch{return null}try{const destination=new URL(clear);return (destination.protocol==="https:"||destination.protocol==="http:")&&!destination.username&&!destination.password?destination:null}catch{return null}}
function ${helper("control")}(target){return target instanceof Element?target.closest(${id.selector}):null}
function ${helper("nested")}(target,control){if(!(target instanceof Element))return false;const interactive=target.closest(${helper("inner")});return interactive!==null&&interactive!==control&&control.contains(interactive)}
function ${helper("selection")}(control){const selection=window.getSelection();if(!selection||selection.isCollapsed||selection.toString().trim()==="")return false;return selection.anchorNode!==null&&control.contains(selection.anchorNode)||selection.focusNode!==null&&control.contains(selection.focusNode)}
function ${helper("native")}(control){return control instanceof HTMLButtonElement||control instanceof HTMLInputElement||control instanceof HTMLAnchorElement&&control.hasAttribute("href")}
function ${id.activate}(control){const destination=${id.decode}(control.getAttribute(${JSON.stringify(config.controlAttribute)}));if(!destination)return;const ${id.attribution}=${id.attribution}Init({trackerURLs:[destination.href],decorateLinks:false});const decorated=${id.attribution}.decorateURL(destination.href);${id.attribution}.stop();const opened=window.open(decorated,"_blank","noopener");if(opened)opened.opener=null}
function ${id.click}(event){if(!event.isTrusted||event.defaultPrevented||event.button!==0||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;const control=${helper("control")}(event.target);if(!control||${helper("nested")}(event.target,control)||${helper("selection")}(control))return;event.preventDefault();${id.activate}(control)}
function ${id.keydown}(event){if(!event.isTrusted||event.defaultPrevented||event.key!=="Enter"&&event.key!==" ")return;const control=${helper("control")}(event.target);if(!control||${helper("nested")}(event.target,control)||${helper("native")}(control))return;event.preventDefault();${id.activate}(control)}
window.addEventListener("click",${id.click});window.addEventListener("keydown",${id.keydown});
`;
}

export async function buildTrackedAffiliateRuntime(input: {
  readonly config: TrackedAffiliateSiteConfig;
  readonly cacheDirectory: string;
}): Promise<string> {
  await mkdir(input.cacheDirectory, { recursive: true });
  const entry = join(input.cacheDirectory, `${input.config.domain.replaceAll(".", "-")}.ts`);
  const output = join(input.cacheDirectory, `${input.config.domain.replaceAll(".", "-")}.js`);
  await writeFile(entry, generatedRuntimeSource(input.config), "utf8");
  try {
    await promisify(execFile)("bun", ["build", entry, "--target=browser", "--format=iife", "--minify-whitespace", "--minify-syntax", `--outfile=${output}`], {
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(`tracked affiliates: compilation du runtime impossible (${details})`);
  }
  const source = await readFile(output, "utf8");
  if (source.includes("</script")) throw new Error("tracked affiliates: runtime inline contient une fermeture de script");
  return source;
}

export function inspectTrackedAffiliateRuntimeSource(config: TrackedAffiliateSiteConfig): string {
  return generatedRuntimeSource(config);
}
