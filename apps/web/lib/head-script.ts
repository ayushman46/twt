/**
 * Tiny blocking script inlined in <head> of both root layouts. It runs before
 * first paint, so nothing flashes:
 *
 * 1. Currency — Indian visitors (Asia/Kolkata time zone, an `-IN` browser
 *    locale or an Indian UI language) see ₹ prices; a saved ₹/$ choice wins.
 *    Sets `<html data-currency="inr|usd">`; CSS shows the matching prices.
 * 2. Reveal-on-scroll — replaces a JS animation library: elements marked
 *    `data-reveal` fade in once they enter the viewport (IntersectionObserver
 *    + a MutationObserver so client-side navigations are covered too).
 *    Skipped for reduced motion and old browsers, which simply show content.
 */
import { CURRENCY_STORAGE_KEY } from "./currency";

const script = `(function(){var d=document.documentElement;
try{var c=localStorage.getItem("${CURRENCY_STORAGE_KEY}");
if(c!=="inr"&&c!=="usd"){var z="";try{z=Intl.DateTimeFormat().resolvedOptions().timeZone||""}catch(e){}
var l=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||""],i=z==="Asia/Kolkata"||z==="Asia/Calcutta";
for(var k=0;k<l.length&&!i;k++){i=/-IN$/i.test(l[k])||/^(hi|bn|mr|te|ta|gu|kn|ml|pa|or|as)(-|$)/i.test(l[k])}
c=i||d.lang==="hi"?"inr":"usd"}
d.setAttribute("data-currency",c)}catch(e){}
try{if(!("IntersectionObserver"in window)||!window.MutationObserver||matchMedia("(prefers-reduced-motion: reduce)").matches)return;
var io=new IntersectionObserver(function(es){for(var j=0;j<es.length;j++){if(es[j].isIntersecting){es[j].target.setAttribute("data-shown","");io.unobserve(es[j].target)}}},{rootMargin:"0px 0px -6% 0px"});
var seen=new WeakSet();function scan(){var n=document.querySelectorAll("[data-reveal]:not([data-shown])");for(var j=0;j<n.length;j++){if(!seen.has(n[j])){seen.add(n[j]);io.observe(n[j])}}}
new MutationObserver(scan).observe(d,{childList:true,subtree:true});d.setAttribute("data-rv","");scan()}catch(e){}})();`;

export const HEAD_SCRIPT = script.replace(/\n/g, "");
