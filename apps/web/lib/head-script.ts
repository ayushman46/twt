/**
 * Tiny blocking script inlined in <head> of both root layouts. It runs before
 * first paint, so nothing flashes:
 *
 * 1. Currency — Indian visitors (Asia/Kolkata time zone, an `-IN` browser
 *    locale or an Indian UI language) see ₹ prices; a saved ₹/$ choice wins.
 *    Sets `<html data-currency="inr|usd">`; CSS shows the matching prices.
 *    The time-zone check needs Intl, whose first use initialises ICU (tens of
 *    ms on phones), so it runs when the browser is idle instead of before
 *    first paint — prices sit far below the fold — unless the page opens on
 *    #pricing.
 *    A saved billing period sets `<html data-period="monthly|yearly">` too.
 * 2. Reveal-on-scroll — replaces a JS animation library: elements marked
 *    `data-reveal` fade in once they enter the viewport (IntersectionObserver
 *    + a MutationObserver so client-side navigations are covered too).
 *    Skipped for reduced motion and old browsers, which simply show content.
 */
import { CURRENCY_EVENT, CURRENCY_STORAGE_KEY, PERIOD_STORAGE_KEY } from "./currency";

const script = `(function(){var d=document.documentElement;
try{var K="${CURRENCY_STORAGE_KEY}",c=localStorage.getItem(K);
if(c!=="inr"&&c!=="usd"){var l=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||""],i=d.lang==="hi";
for(var k=0;k<l.length&&!i;k++){i=/-IN$/i.test(l[k])||/^(hi|bn|mr|te|ta|gu|kn|ml|pa|or|as)(-|$)/i.test(l[k])}
c=i?"inr":"usd";
var ist=function(){try{var z=Intl.DateTimeFormat().resolvedOptions().timeZone;return z==="Asia/Kolkata"||z==="Asia/Calcutta"}catch(e){return false}};
if(!i&&location.hash==="#pricing"){if(ist())c="inr"}
else if(!i){var tz=function(){try{if(ist()&&!localStorage.getItem(K)){d.setAttribute("data-currency","inr");window.dispatchEvent(new Event("${CURRENCY_EVENT}"))}}catch(e){}};
if(window.requestIdleCallback)requestIdleCallback(tz,{timeout:1500});else setTimeout(tz,300)}}
d.setAttribute("data-currency",c)}catch(e){}
try{var p=localStorage.getItem("${PERIOD_STORAGE_KEY}");if(p==="monthly"||p==="yearly")d.setAttribute("data-period",p)}catch(e){}
try{if(!("IntersectionObserver"in window)||!window.MutationObserver||matchMedia("(prefers-reduced-motion: reduce)").matches)return;
var io=new IntersectionObserver(function(es){for(var j=0;j<es.length;j++){if(es[j].isIntersecting){es[j].target.setAttribute("data-shown","");io.unobserve(es[j].target)}}},{rootMargin:"0px 0px -6% 0px"});
var seen=new WeakSet();function scan(){var n=document.querySelectorAll("[data-reveal]:not([data-shown])");for(var j=0;j<n.length;j++){if(!seen.has(n[j])){seen.add(n[j]);io.observe(n[j])}}}
new MutationObserver(scan).observe(d,{childList:true,subtree:true});d.setAttribute("data-rv","");scan()}catch(e){}})();`;

export const HEAD_SCRIPT = script.replace(/\n/g, "");
