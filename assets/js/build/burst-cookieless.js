!function(e,n){"object"==typeof exports&&"undefined"!=typeof module?n(exports):"function"==typeof define&&define.amd?define(["exports"],n):n((e="undefined"!=typeof globalThis?globalThis:e||self).ThumbmarkJS={})}(this,(function(e){"use strict";const n=2592e5,t="thumbmark",r="https://api.thumbmarkjs.com",o={exclude:[],include:[],stabilize:["private","iframe"],logging:!0,collect_beacon:!0,timeout:5e3,cache_api_call:!0,cache_lifetime_in_ms:0,performance:!1,experimental:!1,simple_request:!1,property_name_factory:e=>`${t}_${e}`};let i={...o};const a={private:[{exclude:["canvas"],browsers:["firefox","safari>=17","brave"]},{exclude:["audio"],browsers:["samsungbrowser","safari"]},{exclude:["fonts"],browsers:["firefox"]},{exclude:["audio.sampleHash","hardware.deviceMemory","header.acceptLanguage.q","system.hardwareConcurrency","plugins"],browsers:["brave"]},{exclude:["tls.extensions"],browsers:["firefox","chrome","safari"]},{exclude:["header.acceptLanguage"],browsers:["edge","chrome"]}],iframe:[{exclude:["system.applePayVersion","system.cookieEnabled"],browsers:["safari"]},{exclude:["permissions"]}],vpn:[{exclude:["ip"]}],always:[{exclude:["speech"],browsers:["brave","firefox"]}]},s="undefined"!=typeof window?window.OfflineAudioContext||window.webkitOfflineAudioContext:null;function c(e){let n=0;for(let t=0;t<e.length;++t)n+=Math.abs(e[t]);return n}function l(e,n,t){if(1===e.length)return e[0];if(3===e.length){const r=e[0].data,o=e[1].data,i=e[2].data,a=new Uint8ClampedArray(r.length);for(let e=0;e<r.length;e++){const n=r[e],t=o[e],s=i[e];a[e]=n===t||n===s?n:t===s?t:n}return new ImageData(a,n,t)}let r=[];for(let n=0;n<e[0].data.length;n++){let t=[];for(let r=0;r<e.length;r++)t.push(e[r].data[n]);r.push(u(t))}const o=new Uint8ClampedArray(r);return new ImageData(o,n,t)}function u(e){if(0===e.length)return 0;const n={};for(const t of e)n[t]=(n[t]||0)+1;let t=e[0];for(const e in n)n[e]>n[t]&&(t=parseInt(e,10));return t}function d(e){return e^=e>>>16,e=Math.imul(e,2246822507),e^=e>>>13,e=Math.imul(e,3266489909),(e^=e>>>16)>>>0}const m=new Uint32Array([597399067,2869860233,951274213,2716044179]);function f(e,n){return e<<n|e>>>32-n}function p(e,n=0){if(n=n?0|n:0,"string"==typeof e&&(e=function(e){if("undefined"!=typeof TextEncoder)return(new TextEncoder).encode(e).buffer;const n=[];for(let t=0;t<e.length;t++){let r=e.charCodeAt(t);r<128?n.push(r):r<2048?n.push(192|r>>6,128|63&r):r<55296||r>=57344?n.push(224|r>>12,128|r>>6&63,128|63&r):(t++,r=65536+((1023&r)<<10|1023&e.charCodeAt(t)),n.push(240|r>>18,128|r>>12&63,128|r>>6&63,128|63&r))}return new Uint8Array(n).buffer}(e)),!(e instanceof ArrayBuffer))throw new TypeError("Expected key to be ArrayBuffer or string");const t=new Uint32Array([n,n,n,n]);!function(e,n){const t=e.byteLength/16|0,r=new Uint32Array(e,0,4*t);for(let e=0;e<t;e++){const t=r.subarray(4*e,4*(e+1));t[0]=Math.imul(t[0],m[0]),t[0]=f(t[0],15),t[0]=Math.imul(t[0],m[1]),n[0]=n[0]^t[0],n[0]=f(n[0],19),n[0]=n[0]+n[1],n[0]=Math.imul(n[0],5)+1444728091,t[1]=Math.imul(t[1],m[1]),t[1]=f(t[1],16),t[1]=Math.imul(t[1],m[2]),n[1]=n[1]^t[1],n[1]=f(n[1],17),n[1]=n[1]+n[2],n[1]=Math.imul(n[1],5)+197830471,t[2]=Math.imul(t[2],m[2]),t[2]=f(t[2],17),t[2]=Math.imul(t[2],m[3]),n[2]=n[2]^t[2],n[2]=f(n[2],15),n[2]=n[2]+n[3],n[2]=Math.imul(n[2],5)+2530024501,t[3]=Math.imul(t[3],m[3]),t[3]=f(t[3],18),t[3]=Math.imul(t[3],m[0]),n[3]=n[3]^t[3],n[3]=f(n[3],13),n[3]=n[3]+n[0],n[3]=Math.imul(n[3],5)+850148119}}(e,t),function(e,n){const t=e.byteLength/16|0,r=e.byteLength%16,o=new Uint32Array(4),i=new Uint8Array(e,16*t,r);switch(r){case 15:o[3]=o[3]^i[14]<<16;case 14:o[3]=o[3]^i[13]<<8;case 13:o[3]=o[3]^i[12],o[3]=Math.imul(o[3],m[3]),o[3]=f(o[3],18),o[3]=Math.imul(o[3],m[0]),n[3]=n[3]^o[3];case 12:o[2]=o[2]^i[11]<<24;case 11:o[2]=o[2]^i[10]<<16;case 10:o[2]=o[2]^i[9]<<8;case 9:o[2]=o[2]^i[8],o[2]=Math.imul(o[2],m[2]),o[2]=f(o[2],17),o[2]=Math.imul(o[2],m[3]),n[2]=n[2]^o[2];case 8:o[1]=o[1]^i[7]<<24;case 7:o[1]=o[1]^i[6]<<16;case 6:o[1]=o[1]^i[5]<<8;case 5:o[1]=o[1]^i[4],o[1]=Math.imul(o[1],m[1]),o[1]=f(o[1],16),o[1]=Math.imul(o[1],m[2]),n[1]=n[1]^o[1];case 4:o[0]=o[0]^i[3]<<24;case 3:o[0]=o[0]^i[2]<<16;case 2:o[0]=o[0]^i[1]<<8;case 1:o[0]=o[0]^i[0],o[0]=Math.imul(o[0],m[0]),o[0]=f(o[0],15),o[0]=Math.imul(o[0],m[1]),n[0]=n[0]^o[0]}}(e,t),function(e,n){n[0]=n[0]^e.byteLength,n[1]=n[1]^e.byteLength,n[2]=n[2]^e.byteLength,n[3]=n[3]^e.byteLength,n[0]=n[0]+n[1]|0,n[0]=n[0]+n[2]|0,n[0]=n[0]+n[3]|0,n[1]=n[1]+n[0]|0,n[2]=n[2]+n[0]|0,n[3]=n[3]+n[0]|0,n[0]=d(n[0]),n[1]=d(n[1]),n[2]=d(n[2]),n[3]=d(n[3]),n[0]=n[0]+n[1]|0,n[0]=n[0]+n[2]|0,n[0]=n[0]+n[3]|0,n[1]=n[1]+n[0]|0,n[2]=n[2]+n[0]|0,n[3]=n[3]+n[0]|0}(e,t);const r=new Uint8Array(t.buffer);return Array.from(r).map((e=>e.toString(16).padStart(2,"0"))).join("")}const h=280;function g(e,n){return new Promise((t=>setTimeout(t,e,n)))}const v=["Arial","Arial Black","Arial Narrow","Arial Rounded MT","Arimo","Archivo","Barlow","Bebas Neue","Bitter","Bookman","Calibri","Cabin","Candara","Century","Century Gothic","Comic Sans MS","Constantia","Courier","Courier New","Crimson Text","DM Mono","DM Sans","DM Serif Display","DM Serif Text","Dosis","Droid Sans","Exo","Fira Code","Fira Sans","Franklin Gothic Medium","Garamond","Geneva","Georgia","Gill Sans","Helvetica","Impact","Inconsolata","Indie Flower","Inter","Josefin Sans","Karla","Lato","Lexend","Lucida Bright","Lucida Console","Lucida Sans Unicode","Manrope","Merriweather","Merriweather Sans","Montserrat","Myriad","Noto Sans","Nunito","Nunito Sans","Open Sans","Optima","Orbitron","Oswald","Pacifico","Palatino","Perpetua","PT Sans","PT Serif","Poppins","Prompt","Public Sans","Quicksand","Rajdhani","Recursive","Roboto","Roboto Condensed","Rockwell","Rubik","Segoe Print","Segoe Script","Segoe UI","Sora","Source Sans Pro","Space Mono","Tahoma","Taviraj","Times","Times New Roman","Titillium Web","Trebuchet MS","Ubuntu","Varela Round","Verdana","Work Sans"],y=["monospace","sans-serif","serif"];function w(e,n){return e.font=`72px ${n}`,e.measureText("WwMmLli0Oo").width}function b(){var e;const n=document.createElement("canvas"),t=null!==(e=n.getContext("webgl"))&&void 0!==e?e:n.getContext("experimental-webgl");if(t&&"getParameter"in t)try{const e=(t.getParameter(t.VENDOR)||"").toString(),n=(t.getParameter(t.RENDERER)||"").toString();let r={vendor:e,renderer:n,version:(t.getParameter(t.VERSION)||"").toString(),shadingLanguageVersion:(t.getParameter(t.SHADING_LANGUAGE_VERSION)||"").toString()};if(!n.length||!e.length){const e=t.getExtension("WEBGL_debug_renderer_info");if(e){const n=(t.getParameter(e.UNMASKED_VENDOR_WEBGL)||"").toString(),o=(t.getParameter(e.UNMASKED_RENDERER_WEBGL)||"").toString();n&&(r.vendorUnmasked=n),o&&(r.rendererUnmasked=o)}}return r}catch(e){}return"undefined"}function S(){const e=new Float32Array(1),n=new Uint8Array(e.buffer);return e[0]=1/0,e[0]=e[0]-e[0],n[3]}const _=(e,n,t,r)=>{const o=(t-n)/r;let i=0;for(let t=0;t<r;t++){i+=e(n+(t+.5)*o)}return i*o};function P(e,n){const t={};return n.forEach((n=>{const r=function(e){if(0===e.length)return null;const n={};e.forEach((e=>{const t=String(e);n[t]=(n[t]||0)+1}));let t=e[0],r=1;return Object.keys(n).forEach((e=>{n[e]>r&&(t=e,r=n[e])})),t}(e.map((e=>n in e?e[n]:void 0)).filter((e=>void 0!==e)));r&&(t[n]=r)})),t}const A=["accelerometer","accessibility","accessibility-events","ambient-light-sensor","background-fetch","background-sync","bluetooth","camera","clipboard-read","clipboard-write","device-info","display-capture","gyroscope","geolocation","local-fonts","magnetometer","microphone","midi","nfc","notifications","payment-handler","persistent-storage","push","speaker","storage-access","top-level-storage-access","window-management","query"];const x=new Map;function M(){if("undefined"==typeof navigator)return{name:"unknown",version:"unknown"};const e=!!navigator.brave,n=(e?"B|":"N|")+navigator.userAgent,t=x.get(n);if(t)return t;const r=[{name:"Brave",detect:()=>e}];let o;for(const e of r)if(e.detect()){const t=C(navigator.userAgent);return o={name:e.name,version:t.version},x.set(n,o),o}return o=C(navigator.userAgent),x.set(n,o),o}function C(e){var n,t,r,o,i,a;const s=[/(?<name>SamsungBrowser)\/(?<version>\d+(?:\.\d+)+)/,/(?<name>EdgA|EdgiOS|Edg)\/(?<version>\d+(?:\.\d+)+)/,/(?<name>OPR|OPX)\/(?<version>\d+(?:\.\d+)+)/,/Opera[\s\/](?<version>\d+(?:\.\d+)+)/,/Opera Mini\/(?<version>\d+(?:\.\d+)+)/,/Opera Mobi\/(?<version>\d+(?:\.\d+)+)/,/(?<name>Vivaldi)\/(?<version>\d+(?:\.\d+)+)/,/(?<name>CriOS)\/(?<version>\d+(?:\.\d+)+)/,/(?<name>FxiOS)\/(?<version>\d+(?:\.\d+)+)/,/(?<name>Chrome|Chromium)\/(?<version>\d+(?:\.\d+)+)/,/(?<name>Firefox|Waterfox|Iceweasel|IceCat)\/(?<version>\d+(?:\.\d+)+)/,/Version\/(?<version1>[\d.]+).*Safari\/[\d.]+|(?<name>Safari)\/(?<version2>[\d.]+)/,/(?<name>MSIE|Trident|IEMobile).+?(?<version>\d+(?:\.\d+)+)/,/(?<name>[A-Za-z]+)\/(?<version>\d+(?:\.\d+)+)/],c={edg:"Edge",edga:"Edge",edgios:"Edge",opr:"Opera",opx:"Opera",crios:"Chrome",fxios:"Firefox",samsung:"SamsungBrowser",vivaldi:"Vivaldi"};for(const l of s){const s=e.match(l);if(s){let e=null===(n=s.groups)||void 0===n?void 0:n.name,u=(null===(t=s.groups)||void 0===t?void 0:t.version)||(null===(r=s.groups)||void 0===r?void 0:r.version1)||(null===(o=s.groups)||void 0===o?void 0:o.version2);if(e||!(null===(i=s.groups)||void 0===i?void 0:i.version1)&&!(null===(a=s.groups)||void 0===a?void 0:a.version2)||(e="Safari"),!e&&l.source.includes("Opera Mini")&&(e="Opera Mini"),!e&&l.source.includes("Opera Mobi")&&(e="Opera Mobi"),!e&&l.source.includes("Opera")&&(e="Opera"),!e&&s[1]&&(e=s[1]),!u&&s[2]&&(u=s[2]),e){return{name:c[e.toLowerCase()]||e,version:u||"unknown"}}}}return{name:"unknown",version:"unknown"}}function E(){if("undefined"==typeof navigator||!navigator.userAgent)return!1;const e=navigator.userAgent;return/Mobi|Android|iPhone|iPod|IEMobile|Opera Mini|Opera Mobi|webOS|BlackBerry|Windows Phone/i.test(e)&&!/iPad/i.test(e)}function T(){let e=[];const n={"prefers-contrast":["high","more","low","less","forced","no-preference"],"any-hover":["hover","none"],"any-pointer":["none","coarse","fine"],pointer:["none","coarse","fine"],hover:["hover","none"],update:["fast","slow"],"inverted-colors":["inverted","none"],"prefers-reduced-motion":["reduce","no-preference"],"prefers-reduced-transparency":["reduce","no-preference"],scripting:["none","initial-only","enabled"],"forced-colors":["active","none"]};return Object.keys(n).forEach((t=>{n[t].forEach((n=>{matchMedia(`(${t}: ${n})`).matches&&e.push(`${t}: ${n}`)}))})),e}function k(){if("https:"===window.location.protocol&&"function"==typeof window.ApplePaySession)try{const e=window.ApplePaySession.supportsVersion;for(let n=15;n>0;n--)if(e(n))return n}catch(e){return 0}return 0}const R="SamsungBrowser"!==M().name?1:3,O="Brave"!==M().name,I=137,B=(()=>{const e=new Float32Array(548),n=2*Math.PI/I;for(let t=0;t<I;t++){const r=t*n;e[4*t]=0,e[4*t+1]=0,e[4*t+2]=100*Math.cos(r),e[4*t+3]=50*Math.sin(r)}return e})();let D=null;function L(){try{if("undefined"==typeof document)return null;const e=document.createElement("canvas");e.width=200,e.height=100;const n=e.getContext("webgl");if(!n)return null;e.addEventListener("webglcontextlost",(e=>{e.preventDefault(),D=null}),{once:!0});const t=n.createShader(n.VERTEX_SHADER),r=n.createShader(n.FRAGMENT_SHADER);if(!t||!r)return null;if(n.shaderSource(t,"\n    attribute vec2 position;\n    void main() {\n        gl_Position = vec4(position, 0.0, 1.0);\n    }\n"),n.compileShader(t),!n.getShaderParameter(t,n.COMPILE_STATUS))return null;if(n.shaderSource(r,"\n    precision mediump float;\n    void main() {\n        gl_FragColor = vec4(0.812, 0.195, 0.553, 0.921); // Set line color\n    }\n"),n.compileShader(r),!n.getShaderParameter(r,n.COMPILE_STATUS))return null;const o=n.createProgram();if(!o)return null;if(n.attachShader(o,t),n.attachShader(o,r),n.linkProgram(o),!n.getProgramParameter(o,n.LINK_STATUS))return null;const i=n.createBuffer();return i?(n.bindBuffer(n.ARRAY_BUFFER,i),n.bufferData(n.ARRAY_BUFFER,B,n.STATIC_DRAW),n.bindBuffer(n.ARRAY_BUFFER,null),{canvas:e,gl:n,program:o,buffer:i}):null}catch(e){return null}}function j(e){const n=new Set;return function e(t){if(t&&t.toJSON&&"function"==typeof t.toJSON&&(t=t.toJSON()),void 0===t)return;if("number"==typeof t)return isFinite(t)?""+t:"null";if("object"!=typeof t)return JSON.stringify(t);let r,o;if(Array.isArray(t)){for(o="[",r=0;r<t.length;r++)r&&(o+=","),o+=e(t[r])||"null";return o+"]"}if(null===t)return"null";if(n.has(t))throw new TypeError("Converting circular structure to JSON");n.add(t);const i=Object.keys(t).sort();for(o="",r=0;r<i.length;r++){const n=i[r],a=e(t[n]);a&&(o&&(o+=","),o+=JSON.stringify(n)+":"+a)}return n.delete(t),"{"+o+"}"}(e)||""}const N={audio:async function(){return s?async function(){return new Promise(((e,n)=>{try{const n=new s(1,5e3,44100),t=n.createBufferSource(),r=n.createOscillator();r.frequency.value=1e3;const o=n.createDynamicsCompressor();let i;o.threshold.value=-50,o.knee.value=40,o.ratio.value=12,o.attack.value=0,o.release.value=.2,r.connect(o),o.connect(n.destination),r.start(),n.oncomplete=r=>{i=r.renderedBuffer.getChannelData(0),e({sampleHash:c(i),maxChannels:n.destination.maxChannelCount,channelCountMode:t.channelCountMode})},n.startRendering()}catch(e){n(e)}}))}():null},canvas:async function(){return new Promise((e=>{const n=Array.from({length:3},(()=>function(){const e=document.createElement("canvas"),n=e.getContext("2d");if(!n)return null;e.width=h,e.height=20;const t=n.createLinearGradient(0,0,e.width,e.height);t.addColorStop(0,"red"),t.addColorStop(1/6,"orange"),t.addColorStop(2/6,"yellow"),t.addColorStop(.5,"green"),t.addColorStop(4/6,"blue"),t.addColorStop(5/6,"indigo"),t.addColorStop(1,"violet"),n.fillStyle=t,n.fillRect(0,0,e.width,e.height);const r="Random Text WMwmil10Oo";return n.font="23.123px Arial",n.fillStyle="black",n.fillText(r,-5,15),n.fillStyle="rgba(0, 0, 255, 0.5)",n.fillText(r,-3.3,17.7),n.beginPath(),n.moveTo(0,0),n.lineTo(2*e.width/7,e.height),n.strokeStyle="white",n.lineWidth=2,n.stroke(),n.getImageData(0,0,e.width,e.height)}())).filter((e=>null!==e));0!==n.length?e({commonPixelsHash:p(l(n,h,20).data.toString()).toString()}):e(null)}))},fonts:async function(e){return new Promise((e=>{try{!async function(e){for(var n;!document.body;)await g(50);const t=document.createElement("iframe");t.setAttribute("frameBorder","0");const r=t.style;r.setProperty("position","fixed"),r.setProperty("display","block","important"),r.setProperty("visibility","visible"),r.setProperty("border","0"),r.setProperty("opacity","0"),t.src="about:blank",document.body.appendChild(t);const o=t.contentDocument||(null===(n=t.contentWindow)||void 0===n?void 0:n.document);if(!o)throw new Error("Iframe document is not accessible");e({iframe:o}),setTimeout((()=>{document.body.removeChild(t)}),0)}((async({iframe:n})=>{const t=n.createElement("canvas").getContext("2d");if(!t)return void e(null);const r=y.map((e=>w(t,e)));let o={};v.forEach((e=>{const n=w(t,e);r.includes(n)||(o[e]=n)})),e(o)}))}catch(n){e(null)}}))},hardware:function(){return new Promise(((e,n)=>{const t=void 0!==navigator.deviceMemory?navigator.deviceMemory:0,r=window.performance&&window.performance.memory?window.performance.memory:0;e({videocard:b(),architecture:S(),deviceMemory:t.toString()||"undefined",jsHeapSizeLimit:r.jsHeapSizeLimit||0})}))},locales:function(){return new Promise((e=>{e({languages:navigator.language,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone})}))},math:function(){return new Promise((e=>{e({acos:Math.acos(.5),asin:_(Math.asin,-1,1,97),cos:_(Math.cos,0,Math.PI,97),largeCos:Math.cos(1e20),largeSin:Math.sin(1e20),largeTan:Math.tan(1e20),sin:_(Math.sin,-Math.PI,Math.PI,97),tan:_(Math.tan,0,2*Math.PI,97)})}))},permissions:async function(e){const n=(null==e?void 0:e.permissions_to_check)||A;return P(await Promise.all(Array.from({length:3},(()=>async function(e){const n={};for(const t of e)try{const e=await navigator.permissions.query({name:t});n[t]=e.state.toString()}catch(e){}return n}(n)))),n)},plugins:async function(){const e=[];if(navigator.plugins)for(let n=0;n<navigator.plugins.length;n++){const t=navigator.plugins[n];e.push([t.name,t.filename,t.description].join("|"))}return new Promise((n=>{n({plugins:e})}))},screen:function(){return new Promise((e=>{if("undefined"==typeof matchMedia||"undefined"==typeof screen)return void e(null);const n={is_touchscreen:navigator.maxTouchPoints>0,maxTouchPoints:navigator.maxTouchPoints,colorDepth:screen.colorDepth,mediaMatches:T()};E()&&navigator.maxTouchPoints>0&&(n.resolution=function(){const e=window.screen.width,n=window.screen.height,t=Math.max(e,n).toString(),r=Math.min(e,n).toString();return`${t}x${r}`}()),e(n)}))},system:function(){return new Promise((e=>{const n=M();e({platform:window.navigator.platform,productSub:navigator.productSub,product:navigator.product,useragent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,browser:{name:n.name,version:n.version},mobile:E(),applePayVersion:k(),cookieEnabled:window.navigator.cookieEnabled})}))},webgl:async function(){const e=O?(D||(D=L()),D):L();if(!e)return{webgl:"unsupported"};try{const n=Array.from({length:R},(()=>function(e){const{canvas:n,gl:t,program:r,buffer:o}=e;try{t.useProgram(r),t.bindBuffer(t.ARRAY_BUFFER,o);const e=t.getAttribLocation(r,"position");t.enableVertexAttribArray(e),t.vertexAttribPointer(e,2,t.FLOAT,!1,0,0),t.viewport(0,0,n.width,n.height),t.clearColor(0,0,0,1),t.clear(t.COLOR_BUFFER_BIT),t.drawArrays(t.LINES,0,274);const i=new Uint8ClampedArray(n.width*n.height*4);return t.readPixels(0,0,n.width,n.height,t.RGBA,t.UNSIGNED_BYTE,i),new ImageData(i,n.width,n.height)}catch(e){return D=null,new ImageData(1,1)}finally{t.bindBuffer(t.ARRAY_BUFFER,null),t.useProgram(null),t.viewport(0,0,t.drawingBufferWidth,t.drawingBufferHeight),t.clearColor(0,0,0,0)}}(e)));return{commonPixelsHash:p(l(n,e.canvas.width,e.canvas.height).data.toString()).toString()}}catch(e){return{webgl:"unsupported"}}},webrtc:async function(e){return new Promise((e=>{let n;try{const t=window.RTCPeerConnection||window.webkitRTCPeerConnection||window.mozRTCPeerConnection;if(!t)return void e({supported:!1,error:"WebRTC not supported"});n=new t({iceCandidatePoolSize:1,iceServers:[]});const r=n;r.createDataChannel("");(async()=>{try{const n={offerToReceiveAudio:!0,offerToReceiveVideo:!0},t=await r.createOffer(n);await r.setLocalDescription(t);const o=t.sdp||"",i=[...new Set((o.match(/extmap:\d+ [^\n\r]+/g)||[]).map((e=>e.replace(/extmap:\d+ /,""))))].sort(),a=e=>{const n=o.match(new RegExp(`m=${e} [^\\s]+ [^\\s]+ ([^\\n\\r]+)`));return n?n[1].split(" "):[]},s=(e,n)=>n.map((n=>{const t=new RegExp(`(rtpmap|fmtp|rtcp-fb):${n} (.+)`,"g"),r=[...o.matchAll(t)];if(!r.length)return null;const i={};return r.forEach((n=>{const[t,r,o]=n,a=o.split("/");"rtpmap"===r?(i.mimeType=`${e}/${a[0]}`,i.clockRate=+a[1],"audio"===e&&(i.channels=+a[2]||1)):"rtcp-fb"===r?(i.feedbackSupport=i.feedbackSupport||[],i.feedbackSupport.push(o)):"fmtp"===r&&(i.sdpFmtpLine=o)})),i})).filter(Boolean),c=s("audio",a("audio")),l=s("video",a("video")),u={audio:{count:c.length,hash:p(j(c))},video:{count:l.length,hash:p(j(l))},extensionsHash:p(j(i))};r.close();const d={supported:!0,...u,candidateType:"host"};e({details:d,hash:p(j(d))})}catch(n){r.close(),e({supported:!0,error:`WebRTC offer failed: ${n.message}`})}})()}catch(t){null==n||n.close(),e({supported:!1,error:`WebRTC error: ${t.message}`})}}))},speech:async function(){return new Promise((e=>{try{if("undefined"==typeof window||!window.speechSynthesis||"function"!=typeof window.speechSynthesis.getVoices)return void e({supported:!1,error:"Speech Synthesis API not supported"});let n=!1,t=null;const r=r=>{if(!n){n=!0,t&&clearTimeout(t);try{const n=r.map((e=>{const n=e=>e.replace(/\\/g,"\\\\").replace(/,/g,"\\,");return[n(e.voiceURI||""),n(e.name||""),n(e.lang||""),e.localService?"1":"0",e.default?"1":"0"].join(",")}));n.sort();const t={voiceCount:r.length,voicesHash:p(j(n))};e({details:t,hash:p(j(t))})}catch(n){e({supported:!0,error:`Voice processing failed: ${n.message}`})}}},o=window.speechSynthesis.getVoices();if(o.length>0)return void r(o);t=setTimeout((()=>{const e=window.speechSynthesis.getVoices();r(e)}),800);const i=()=>{window.speechSynthesis.removeEventListener("voiceschanged",i);const e=window.speechSynthesis.getVoices();r(e)};window.speechSynthesis.addEventListener("voiceschanged",i)}catch(n){e({supported:!1,error:`Speech Synthesis error: ${n.message}`})}}))}},U={},F={timeout:"true"};function $(){return"1.12.0"}function V(e,n){var t,r;let o=M();if("unknown"===o.name&&n){const e=null===(t=n.system)||void 0===t?void 0:t.browser;(null==e?void 0:e.name)&&(o={name:String(e.name),version:String(e.version||"unknown")})}const i=o.name.toLowerCase(),s=parseInt(o.version.split(".")[0]||"0",10),c=Array.isArray(null==e?void 0:e.exclude)?[...e.exclude]:[],l=[...new Set([...(null==e?void 0:e.stabilize)||[],"always"])];for(const e of l){const n=a[e];if(n)for(const e of n)"browsers"in e&&!(null===(r=e.browsers)||void 0===r?void 0:r.some((e=>{const n=e.match(/(.+?)(>=)(\d+)/);return n?i===n[1]&&s>=+n[3]:i===e})))||c.push(...e.exclude)}return c}function W(e,n){const t=V(n,e),r=Array.isArray(null==n?void 0:n.include)?n.include:[];return function e(n,o=""){const i={};for(const[a,s]of Object.entries(n)){const n=o?`${o}.${a}`:a;if("object"!=typeof s||Array.isArray(s)||null===s){const e=t.some((e=>n.startsWith(e))),o=r.some((e=>n.startsWith(e)));e&&!o||(i[a]=s)}else{const t=e(s,n);Object.keys(t).length>0&&(i[a]=t)}}return i}(e)}const G="https://experimental.thumbmarkjs.com/experimental.min.js",H=131072;function q(e,n){const t={target:"request",type:e};return n&&(t.message=n.slice(0,200)),{schema:0,payload_id:"none",signals:{},errors:[t]}}function J(e){if("object"!=typeof e||null===e||Array.isArray(e))return!1;const n=Object.getPrototypeOf(e);return n===Object.prototype||null===n}function z(e){return e instanceof Error?e.message:void 0}async function Y(){var e;try{return null!==(e=await function(e,n){let t;const r=new Promise((e=>{t=setTimeout((()=>e(null)),n)}));return Promise.race([e,r]).finally((()=>clearTimeout(t)))}(async function(){let e,n;try{const n=await fetch(G,{method:"GET"});if(!n.ok)return q("http",`HTTP ${n.status}`);e=await n.text()}catch(e){return q("fetch",z(e))}if(!e)return q("empty");if(e.length>H)return q("oversized",`${e.length} chars`);try{const t=eval;n=await Promise.resolve(t(e))}catch(e){return q(function(e){return e instanceof SyntaxError?"syntax":e instanceof EvalError?"eval_blocked":"threw"}(e),z(e))}return function(e){return!!J(e)&&!("number"!=typeof e.schema||e.schema<1)&&"string"==typeof e.payload_id&&J(e.signals)}(n)?{...n,errors:Array.isArray(n.errors)?n.errors:[]}:q("malformed")}(),2e3))&&void 0!==e?e:q("timeout","exceeded 2000ms")}catch(e){return q("threw",z(e))}}const K="_tmjs_c";function X(e){return(new TextEncoder).encode(e).length}function Z(){try{if("undefined"==typeof sessionStorage)return;sessionStorage.setItem(K,"1")}catch(e){}}function Q(e,n,t){try{if(!1===n.collect_beacon)return;if(!e||X(e)>64)return;if(function(){try{return"undefined"!=typeof sessionStorage&&!!sessionStorage.getItem(K)}catch(e){return!1}}())return;const r=n.collect_endpoint||"https://collect.thumbmarkjs.com/beacon",o="undefined"!=typeof navigator?navigator.userAgent:"",i={thumbmark:e};o&&X(o)<=512&&(i.ua=o),(null==t?void 0:t.ja4)&&X(t.ja4)<=64&&(i.ja4=t.ja4),(null==t?void 0:t.source)&&X(t.source)<=32&&(i.ja4_source=t.source);const a=JSON.stringify(i);if("undefined"!=typeof navigator&&"function"==typeof navigator.sendBeacon){let e=!1;try{e=navigator.sendBeacon(r,a)}catch(n){e=!1}if(e)return void Z()}try{const e=fetch(r,{method:"POST",mode:"no-cors",keepalive:!0,headers:{"Content-Type":"text/plain;charset=UTF-8"},body:a});Z(),e.catch((()=>{}))}catch(e){}}catch(e){}}const ee="visitor_id";function ne(e){return e.storage_property_name?e.storage_property_name:e.property_name_factory(ee)}const te=`${t}_${ee}`;function re(e,n){try{localStorage.setItem(ne(n),e)}catch(e){}}const oe="cache";function ie(e){try{const n=localStorage.getItem(e.property_name_factory(oe)),t=JSON.parse(n);return t||{}}catch(e){}return{}}function ae(e){return e.cache_lifetime_in_ms>n?Date.now()+n:Date.now()+e.cache_lifetime_in_ms}class se extends Error{constructor(e){super(`HTTP error! status: ${e}`),this.status=e}}let ce=null,le=null;async function ue(e,n,t,r){const o=t.simple_request?{"Content-Type":"text/plain"}:{"x-api-key":t.api_key,Authorization:"custom-authorized","Content-Type":"application/json"},i=await fetch(e,{method:"POST",headers:o,body:JSON.stringify(n)});if(!i.ok)throw new se(i.status);const a=await i.json();return a.visitorId&&a.visitorId!==r&&re(a.visitorId,t),le=a,function(e,n){if(!e.cache_api_call||!e.cache_lifetime_in_ms)return;const{collect:t,...r}=n;!function(e,n){const t={...ie(e),...n};try{localStorage.setItem(e.property_name_factory(oe),JSON.stringify(t))}catch(e){}}(e,{apiResponseExpiry:ae(e),apiResponse:r})}(t,a),a}const de=(e,n)=>{var t;if(e.cache_api_call){if(le)return Promise.resolve(le);const n=function(e){const n=ie(e);if(n&&n.apiResponse&&n.apiResponseExpiry&&Date.now()<=n.apiResponseExpiry)return n.apiResponse;return}(e);if(n)return Promise.resolve(n);if(ce)return ce}const o=e.api_endpoint||r;let i;try{const e=new URL(o);i="/"!==e.pathname||o.endsWith("/")?o:`${e.origin}/thumbmark`}catch(e){i=`${o}/thumbmark`}const a=function(e){try{const n=ne(e);let t=localStorage.getItem(n);return t||n===te||(t=localStorage.getItem(te),t&&re(t,e)),t}catch(e){return null}}(e),{api_key:s,...c}=e,l={components:n,options:c,clientHash:p(j(n)),version:"1.12.0",path:null===(t=null===window||void 0===window?void 0:window.location)||void 0===t?void 0:t.pathname};if(a&&(l.visitorId=a),e.metadata){const n="function"==typeof e.metadata?e.metadata():e.metadata;if(n){("string"==typeof n?n.length:JSON.stringify(n).length)>1e3?console.error("ThumbmarkJS: Metadata exceeds 1000 characters. Skipping metadata."):l.metadata=n}}const u=e.timeout||5e3,d=async function(e,n,t,r){for(let o=0;o<3;o++){o>0&&await new Promise((e=>setTimeout(e,200*o)));try{return await ue(e,n,t,r)}catch(e){if(e instanceof se||2===o)throw e}}throw new Error("Unreachable")}(i,l,e,a).finally((()=>{ce=null})),m=new Promise((n=>{setTimeout((()=>{const t=ie(e);n((null==t?void 0:t.apiResponse)||{info:{timed_out:!0},...a&&{visitorId:a}})}),u)}));return ce=Promise.race([d,m]),ce};async function me(e,n={}){var t;if("undefined"==typeof document||"undefined"==typeof window)return{thumbmark:"",components:{},info:{},version:"1.12.0",error:[{type:"fatal",message:"Browser environment required"}]};try{const i={...o,...e},a=[],s=i.logging&&!sessionStorage.getItem("_tmjs_l")&&Math.random()<1e-4,c={...N,...U,...n},{elapsed:l,resolvedComponents:u,errors:d,pipelineTimings:m}=await fe(c,i);a.push(...d);const f=i.api_key||i.simple_request?de(i,u):null;let h=null;if(f)try{h=await f}catch(e){if(e instanceof se&&403===e.status)return{error:[{type:"api_unauthorized",message:"Invalid API key or quota exceeded"}],components:{},info:{},version:"1.12.0",thumbmark:""};a.push({type:e instanceof se?"api_error":"network_error",message:e instanceof Error?e.message:String(e)})}(null===(t=null==h?void 0:h.info)||void 0===t?void 0:t.timed_out)&&a.push({type:"api_timeout",message:"API request timed out"});const g=performance.now(),v=W((null==h?void 0:h.components)||{},i),y=performance.now()-g,w={...u,...v},b=(null==h?void 0:h.info)||{uniqueness:{score:"api only"}};let S,_=0,P=0;if(null==h?void 0:h.thumbmark)S=h.thumbmark;else{const e=performance.now(),n=j(w);_=performance.now()-e;const t=performance.now();S=p(n),P=performance.now()-t}const A="1.12.0";s&&async function(e,n,t,o=[]){var i;const a=`${r}/log`;sessionStorage.setItem("_tmjs_l","1");const s={thumbmark:e,components:n,experimental:await Y(),version:"1.12.0",options:t,path:null===(i=null===window||void 0===window?void 0:window.location)||void 0===i?void 0:i.pathname,...o.length>0&&{errors:o}};try{await fetch(a,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(s)})}catch(e){}}(S,w,i,a).catch((()=>{})),(null==h?void 0:h.collect)&&"object"==typeof h.collect&&Q(S,i,h.collect);const x={"_pipeline.dispatch":m["_pipeline.dispatch"],"_pipeline.resolve":m["_pipeline.resolve"],"_pipeline.filter":m["_pipeline.filter"]+y,"_pipeline.stringify":_,"_pipeline.hash":P,"_pipeline.assembly":0},M={...l,...m,...x},C=i.performance?{elapsed:M}:{},E=performance.now(),T={...(null==h?void 0:h.visitorId)&&{visitorId:h.visitorId},thumbmark:S,components:w,info:b,version:A,...C,...a.length>0&&{error:a},...(null==h?void 0:h.requestId)&&{requestId:h.requestId},...(null==h?void 0:h.metadata)&&{metadata:h.metadata}};return M["_pipeline.assembly"]=performance.now()-E,T}catch(e){return{thumbmark:"",components:{},info:{},version:"1.12.0",error:[{type:"fatal",message:e instanceof Error?e.message:String(e)}]}}}async function fe(e,n){const t={...o,...n},r=V(t).filter((e=>!e.includes("."))),i=Object.entries(e).filter((([e])=>{var n;return!(null===(n=null==t?void 0:t.exclude)||void 0===n?void 0:n.includes(e))})).filter((([e])=>!r.includes(e))).filter((([e])=>{var n,r,o,i;return(null===(n=null==t?void 0:t.include)||void 0===n?void 0:n.some((e=>e.includes("."))))?null===(r=null==t?void 0:t.include)||void 0===r?void 0:r.some((n=>n.startsWith(e))):0===(null===(o=null==t?void 0:t.include)||void 0===o?void 0:o.length)||(null===(i=null==t?void 0:t.include)||void 0===i?void 0:i.includes(e))})),a=i.map((([e])=>e)),s={},c=performance.now(),l=i.map((([e,t])=>{const r=performance.now(),o=t(n);return s[`_dispatch.${e}`]=performance.now()-r,o})),u=performance.now()-c,d=performance.now(),m=await function(e,n,t){return Promise.all(e.map((e=>{const r=performance.now();let o;const i=e.then((e=>(void 0!==o&&clearTimeout(o),{value:e,elapsed:performance.now()-r}))).catch((e=>(void 0!==o&&clearTimeout(o),{value:t,elapsed:performance.now()-r,error:e instanceof Error?e.message:String(e)}))),a=new Promise((e=>{o=setTimeout((()=>{e({value:t,elapsed:performance.now()-r,error:"timeout"})}),n)}));return Promise.race([i,a])})))}(l,(null==t?void 0:t.timeout)||5e3,F),f=performance.now()-d,p={},h={},g=[];m.forEach(((e,n)=>{var t;const r=a[n];p[r]=null!==(t=e.elapsed)&&void 0!==t?t:0,"timeout"===e.error?g.push({type:"component_timeout",message:`Component '${r}' timed out`,component:r}):e.error&&g.push({type:"component_error",message:e.error,component:r}),null!=e.value&&(h[r]=e.value)}));const v=performance.now(),y=W(h,t),w={"_pipeline.dispatch":u,"_pipeline.resolve":f,"_pipeline.filter":performance.now()-v,...s};return{elapsed:p,resolvedComponents:y,errors:g,pipelineTimings:w}}e.Thumbmark=class{constructor(e){this.options={...o,...e},this.customComponents={}}async get(e){return me({...this.options,...e},this.customComponents)}getVersion(){return"1.12.0"}includeComponent(e,n){this.customComponents[e]=n}},e.filterThumbmarkData=W,e.getFingerprint=async function(e){try{const n=await me(i);return e?{hash:n.thumbmark.toString(),data:n.components}:n.thumbmark.toString()}catch(e){throw e}},e.getFingerprintData=async function(){return(await me(i)).components},e.getFingerprintPerformance=async function(){try{const{elapsed:e,resolvedComponents:n}=await fe(N,i);return{...n,elapsed:e}}catch(e){throw e}},e.getThumbmark=me,e.getVersion=$,e.includeComponent=(e,n,t)=>{U[e]=n},e.setOption=function(e,n){i[e]=n},e.stabilizationExclusionRules=a,e.stableStringify=j}));
//# sourceMappingURL=thumbmark.umd.js.map

/**
 * Tracking consent check, shared by burst.js and events-early-bootstrap.js.
 *
 * Not loaded on its own: gulp prepends it to both builds, so the bootstrap can
 * check consent when an event is triggered, before burst.js has loaded. Function
 * declarations, not `const`, because both scripts run on the same page and a
 * repeated top-level `const` throws "Identifier has already been declared".
 */

/**
 * Get tracking consent state via WP Consent API or consent managers.
 * @returns {'yes' | 'no' | 'undecided'}
 */
function burst_consent_state() {
  if ( typeof wp_has_consent !== 'function' ) {
    // Optional: the early bootstrap runs in <head> before burst.js sets
    // burst.options. It only drops events on a definitive 'no', so 'undecided'
    // and 'yes' are equivalent there and a missing flag must not throw.
    return window.burst.options?.consent_api_active ? 'undecided' : 'yes';
  }

  if ( window.waitfor_consent_hook && typeof window.wp_consent_type === 'undefined' ) {
    return 'undecided';
  }
  return wp_has_consent( 'statistics' ) ? 'yes' : 'no';
}

/**
 * Check if tracking consent is granted via WP Consent API or consent managers.
 * @returns {boolean}
 */
function burst_has_tracking_consent() {
  return burst_consent_state() === 'yes';
}

// TimeMe.js should be loaded and running to track time as soon as it is loaded.

/**
 * @typedef {Object} BurstOptions
 * @property {string} privacy_level
 * @property {boolean} cookieless
 * @property {string} pageUrl
 * @property {boolean} beacon_enabled
 * @property {boolean} do_not_track
 * @property {boolean} enable_turbo_mode
 * @property {boolean} track_url_change
 * @property {boolean} track_external_links
 * @property {boolean} enable_custom_events
 * @property {boolean} track_gtag_events
 * @property {number} page_weight_sample_rate
 * @property {number} cookie_retention_days
 * @property {number} page_id
 * @property {boolean} consent_api_active
 * @property {boolean} debug
 */

/**
 * @typedef {Object} BurstState
 * @property {Object} tracking
 * @property {boolean} tracking.isInitialHit
 * @property {boolean} tracking.initialized
 * @property {number} tracking.lastUpdateTimestamp
 * @property {string|null} tracking.currentUrl
 * @property {string} tracking.beacon_url
 * @property {string} tracking.ajaxUrl
 * @property {BurstOptions} options
 * @property {Object} pageWeight
 * @property {boolean} pageWeight.eligible
 * @property {boolean} pageWeight.sampled
 * @property {number|null} pageWeight.bytes
 * @property {string|null} pageWeight.url
 * @property {Object} goals
 * @property {number[]} goals.completed
 * @property {string} goals.scriptUrl
 * @property {Array} goals.active
 * @property {Object} cache
 * @property {string|null} cache.uid
 * @property {string|null} cache.fingerprint
 * @property {boolean|null} cache.isUserAgent
 * @property {boolean|null} cache.isDoNotTrack
 * @property {boolean|null} cache.useCookies
 * @property {Object} [events] Custom events API from events.js, only loaded when custom events are enabled.
 * @property {boolean} isLoaded
 * @property {boolean} should_load_ecommerce
 */

// burst_consent_state() and burst_has_tracking_consent() come from consent.js,
// which gulp prepends to this file's builds.

// Ensure tracking object exists
burst.tracking = burst.tracking || {
  isInitialHit: true,
  initialized: false,
  lastUpdateTimestamp: 0,
  ajaxUrl: '',
  currentUrl: null,
};

burst.should_load_ecommerce = burst.should_load_ecommerce || false;

// Cache fallback normalizations
burst.cache = burst.cache || {
  uid: null,
  fingerprint: null,
  isUserAgent: null,
  isDoNotTrack: null,
  useCookies: null
};

// Normalize goal IDs
if (burst.goals?.active) {
  burst.goals.active = burst.goals.active.map(goal => ({
    ...goal,
    ID: parseInt(goal.ID, 10)
  }));
}
if (burst.goals?.completed) {
  burst.goals.completed = burst.goals.completed.map(id => parseInt(id, 10));
}

// Page rendering promise
const pageIsRendered = new Promise(resolve => {
  if (document.prerendering) {
    document.addEventListener('prerenderingchange', resolve, { once: true });
  } else {
    resolve();
  }
});
// Inject goals script as a regular script tag to avoid CORS issues in headless setups.
// Dynamic import() enforces CORS; a script tag does not.
if (burst.goals?.active?.some(goal => !goal.page_url || goal.page_url === '' || goal.page_url === burst.options.pageUrl)) {
  const script = document.createElement('script');
  script.async = true;
  script.src = burst.goals.scriptUrl;
  document.head.appendChild(script);
}

/**
 * Get a cookie by name
 * @param name
 * @returns {Promise}
 */
const burst_get_cookie = name => {
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let c of ca) {
    c = c.trim();
    if (c.indexOf(nameEQ) === 0) {
      // An empty value counts as absent. Browsers that stored an empty burst_uid
      // cookie would otherwise keep reading it back as their identifier.
      const value = c.substring(nameEQ.length);
      if (value) return Promise.resolve(value);
    }
  }
  return Promise.reject(false);
};
/**
 * Set a cookie
 * @param name
 * @param value
 */
const burst_set_cookie = (name, value) => {
  if (!burst_has_tracking_consent() || !value) return;
  const path = '/';
  let domain = '';
  let secure = location.protocol === 'https:' ? ';secure' : '';
  const date = new Date();
  date.setTime(date.getTime() + (burst.options.cookie_retention_days * 86400000));
  const expires = ';expires=' + date.toGMTString();
  if (domain) domain = ';domain=' + domain;
  document.cookie = `${name}=${value};SameSite=Strict${secure}${expires}${domain};path=${path}`;
};
/**
 * Should we use cookies for tracking
 * @returns {boolean}
 */
const burst_use_cookies = () => {
  if (!burst_has_tracking_consent()) {
    return false;
  }
  if (burst.cache.useCookies !== null) return burst.cache.useCookies;
  const result = navigator.cookieEnabled && !burst.options.cookieless && burst.options.privacy_level !== 'private_mode';
  burst.cache.useCookies = result;
  return result;
};
/**
 * Enable or disable cookies
 * @returns {boolean}
 */
function burst_enable_cookies() {
  burst.options.cookieless = false;
  burst.cache.useCookies = null;
  if (burst_use_cookies()) {
    burst_uid().then(uid => burst_set_cookie('burst_uid', uid));
  }
}
/**
 * Get or set the user identifier
 * @returns {Promise}
 */
const burst_uid = () => {
  if (burst.cache.uid) return Promise.resolve(burst.cache.uid);
  return burst_get_cookie('burst_uid').then(cookie_uid => {
    burst.cache.uid = cookie_uid;
    return cookie_uid;
  }).catch(() => {
    const uid = burst_generate_uid();
    burst_set_cookie('burst_uid', uid);
    burst.cache.uid = uid;
    return uid;
  });
};
/**
 * Generate a random string
 *
 * Built with a plain loop on purpose. Legacy libraries that themes still load
 * (Prototype, MooTools) overwrite Array.from with a single-argument version
 * that silently ignores the map callback, which turned this into an empty
 * string and left every visitor on such a site without an identifier.
 *
 * @returns {string}
 */
const burst_generate_uid = () => {
  let uid = '';
  for (let i = 0; i < 32; i++) {
    uid += Math.floor(Math.random() * 16).toString(16); // nosemgrep
  }
  return uid;
};

const burst_fingerprint = () => {
  if (burst.cache.fingerprint !== null) return Promise.resolve(burst.cache.fingerprint);
  const tm = new ThumbmarkJS.Thumbmark({
    // The webgl component renders a shader pattern and hashes the pixels. It
    // costs ~190ms on desktop (4x on mobile) inside the first-interaction long
    // task, while the GPU vendor/renderer strings already live in the cheap
    // `hardware` component and canvas covers rasterization differences. Brave
    // and Firefox also randomize WebGL pixel output per session, so dropping it
    // makes the fingerprint more stable for those visitors.
    // system.applePayVersion reads window.ApplePaySession, which payment
    // scripts define on the checkout page only (the PayPal SDK loads Apple's
    // apple-pay-sdk.js, which installs it in every browser). Including it gives
    // a buyer a new fingerprint on checkout, so the order is attributed to a
    // different visitor than the cart and the cart is never marked converted.
    exclude: ['webgl', 'system.applePayVersion'],

    permissions_to_check: [
      'geolocation',
      'notifications',
      'camera',
      'microphone',
      'gyroscope',
      'accelerometer',
      'magnetometer',
      'ambient-light-sensor',
      'background-sync',
      'persistent-storage'
    ]
  });

  return tm.get().then(result => {
    let baseFingerprint = result.thumbmark;

    const extraEntropy = [
      // Screen details
      screen.availWidth + 'x' + screen.availHeight,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      window.devicePixelRatio || 1,

      // System info
      navigator.hardwareConcurrency || 0,
      navigator.deviceMemory || 0,
      navigator.maxTouchPoints || 0,
      new Date().getTimezoneOffset(),

      // Browser capabilities
      navigator.cookieEnabled ? '1' : '0',
      typeof(Storage) !== 'undefined' ? '1' : '0',
      typeof(indexedDB) !== 'undefined' ? '1' : '0',
      navigator.onLine ? '1' : '0',
      navigator.languages ? navigator.languages.slice(0, 3).join(',') : navigator.language,

      // Platform details
      navigator.platform,
      navigator.oscpu || '',

      navigator.connection ? navigator.connection.effectiveType || '' : '',

      'ontouchstart' in window ? '1' : '0',
      typeof window.orientation !== 'undefined' ? '1' : '0',
      window.screen.orientation ? window.screen.orientation.type || '' : ''
    ].filter(item => item !== '').join('|');

    const combinedData = baseFingerprint + '|' + extraEntropy;

    let hash = 0;
    for (let i = 0; i < combinedData.length; i++) {
      const char = combinedData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
    const finalFingerprint = hashHex + baseFingerprint.substring(8);

    burst.cache.fingerprint = finalFingerprint;
    return finalFingerprint;

  }).catch(error => {
    console.error(error);
    return null;
  });
};

const burst_get_time_on_page = () => {
  if (typeof TimeMe === 'undefined') return Promise.resolve(0);
  const time = TimeMe.getTimeOnCurrentPageInMilliseconds();
  TimeMe.resetAllRecordedPageTimes();
  TimeMe.initialize({ idleTimeoutInSeconds: 30 });
  return Promise.resolve(time);
};
/**
 * Check if this is a user agent
 * @returns {boolean}
 */
const burst_is_user_agent = () => {
  if (burst.cache.isUserAgent !== null) return burst.cache.isUserAgent;
  // GoogleOther and Google-InspectionTool render JavaScript but have no "bot" in their user agent.
  const botPattern = /bot|spider|crawl|slurp|mediapartners|applebot|bing|duckduckgo|yandex|baidu|facebook|twitter|googleother|google-inspectiontool/i;
  const result = botPattern.test(navigator.userAgent);
  burst.cache.isUserAgent = result;
  return result;
};

const burst_is_do_not_track = () => {
  if (burst.cache.isDoNotTrack !== null) return burst.cache.isDoNotTrack;
  if (!burst.options.do_not_track) {
    burst.cache.isDoNotTrack = false;
    return false;
  }
    // check for doNotTrack and globalPrivacyControl headers
  const result =
		"1" === navigator.doNotTrack ||
		"yes" === navigator.doNotTrack ||
		"1" === navigator.msDoNotTrack ||
		"1" === window.doNotTrack ||
		1 === navigator.globalPrivacyControl;
  burst.cache.isDoNotTrack = result;
  return result;
};
/**
 * Debug is enabled by the localized option (BURST_DEBUG) or at runtime by the
 * auto debug window inline flag, which can override a debug value baked into
 * the combined script file.
 * @returns {boolean}
 */
const burst_debug_enabled = () => !!( burst.options.debug || window.burst_debug );

const burst_log_tracking_error = ({ status = 0, error = '', data = {} }) => {
  if ( !burst_debug_enabled() || !burst.tracking.ajaxUrl ) {
    return;
  }

  // Report at most one error per browser session: when tracking is down every
  // pageview fails, and each report is a full admin-ajax request.
  try {
    if ( sessionStorage.getItem( 'burst_error_reported' ) ) {
      return;
    }
    sessionStorage.setItem( 'burst_error_reported', '1' );
  } catch ( e ) {
    // sessionStorage unavailable; report anyway.
  }

  fetch(burst.tracking.ajaxUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      action: 'burst_tracking_error',
      status,
      error,
      data: data
    })
  });
};

/**
 * Send the hit payload to the beacon endpoint with a keepalive fetch.
 *
 * @param {Blob}   blob    The JSON payload as a blob.
 * @param {string} payload The raw JSON payload, reported on failure in debug mode.
 */
const burst_beacon_fetch = (blob, payload) => {
  fetch(burst.tracking.beacon_url, {
    method: 'POST',
    body: blob,
    keepalive: true,
    headers: {
      'Content-Type': 'application/json'
    }
  }).then(response => {
    if (!response.ok && burst_debug_enabled()) {
      burst_log_tracking_error({
        status: 0,
        error: 'sendBeacon failed',
        data: payload
      });
    }
  }).catch(error => {
    if (burst_debug_enabled()) {
      burst_log_tracking_error({
        status: 0,
        error: error?.message || 'sendBeacon failed',
        data: payload
      });
    }
  });
};

/**
 * Send the hit payload to the beacon endpoint.
 *
 * sendBeacon is the default transport: JavaScript-rendering crawlers such as
 * Google's renderer execute fetch() but drop beacons, so a fetch-first
 * transport counts them as visitors. fetch is only used in debug mode, where
 * the response is needed to report errors, or when the beacon was not queued.
 *
 * @param {string} payload The JSON payload.
 */
const burst_beacon_request = (payload) => {
  const blob = new Blob([payload], { type: 'application/json' });
  const canFetch = typeof fetch === 'function';
  if (burst_debug_enabled() && canFetch) {
    burst_beacon_fetch(blob, payload);
    return;
  }

  const isQueued = typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(burst.tracking.beacon_url, blob);
  if (!isQueued && canFetch) {
    burst_beacon_fetch(blob, payload);
  }
};

/**
 * Make a XMLHttpRequest and return a promise
 * @param obj
 * @returns {Promise<unknown>}
 */
const burst_api_request = obj => {
  const payload = JSON.stringify(obj.data || {});
  return new Promise(resolve => {
    if (burst.options.beacon_enabled) {
      burst_beacon_request(payload);
      resolve({ status: 200, data: 'ok' });
    } else {
      const token = Math.random().toString(36).substring(2, 9);// nosemgrep
      wp.apiFetch({
        path: `/burst/v1/track/?token=${token}`,
        keepalive: true,
        method: 'POST',
        data: payload,
      }).then(res => {
        const status = res.status || 200;
        resolve({ status, data: res.data || res });
        if (status !== 200) {
          burst_log_tracking_error({
            status,
            error: 'Non-200 status',
            data: payload
          });
        }
      }).catch(error => {
        resolve({ status: 200, data: 'ok' });
        burst_log_tracking_error({
          status: 0,
          error: error?.message || 'Burst tracking request failed',
          data: payload
        });
      });
    }
  });
};

/**
 * Scroll depth and zone dwell time tracking
 */
let burstMaxScroll = 0;
let burstLastScrollTimestamp = Date.now();
let burstCurrentZone = '0_25';
const burstDwellTimePerZone = {
  '0_25': 0,
  '25_50': 0,
  '50_75': 0,
  '75_100': 0,
};

function burst_update_scroll_metrics() {
  const now = Date.now();
  const elapsedMs = Math.max(0, now - burstLastScrollTimestamp);
  burstLastScrollTimestamp = now;

  if (document.visibilityState === 'visible' && elapsedMs > 0 && elapsedMs < 300000) {
    if (burstDwellTimePerZone[burstCurrentZone] !== undefined) {
      burstDwellTimePerZone[burstCurrentZone] += elapsedMs;
    }
  }

  const docHeight = Math.max(
    document.body?.scrollHeight || 0,
    document.documentElement?.scrollHeight || 0,
    document.body?.offsetHeight || 0,
    document.documentElement?.offsetHeight || 0
  );
  const winHeight = window.innerHeight || document.documentElement?.clientHeight || 0;
  const scrollTop = window.scrollY || window.pageYOffset || document.documentElement?.scrollTop || 0;

  let currentPercent = 0;
  if (docHeight > winHeight) {
    currentPercent = Math.min(100, Math.max(0, Math.round((scrollTop / (docHeight - winHeight)) * 100)));
  } else {
    currentPercent = 100;
  }

  if (currentPercent > burstMaxScroll) {
    burstMaxScroll = currentPercent;
  }

  if (currentPercent < 25) {
    burstCurrentZone = '0_25';
  } else if (currentPercent < 50) {
    burstCurrentZone = '25_50';
  } else if (currentPercent < 75) {
    burstCurrentZone = '50_75';
  } else {
    burstCurrentZone = '75_100';
  }
}

let burstScrollTicking = false;
function burst_handle_scroll() {
  if (!burstScrollTicking) {
    window.requestAnimationFrame(() => {
      burst_update_scroll_metrics();
      burstScrollTicking = false;
    });
    burstScrollTicking = true;
  }
}

function burst_init_scroll_tracker() {
  burstLastScrollTimestamp = Date.now();
  burst_update_scroll_metrics();
  window.addEventListener('scroll', burst_handle_scroll, { passive: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', burst_init_scroll_tracker, { once: true });
} else {
  burst_init_scroll_tracker();
}

/**
 * Page weight sampling: picks a share of pageviews, measures what the initial
 * load transferred once the network has gone quiet, and hands the sample to
 * the exit hit (or an SPA navigation flush) for delivery.
 */
burst.pageWeight = {

  /** Whether this pageview was picked for sampling. */
  eligible: false,

  /** Whether a sample has already been handed to a hit. */
  sampled: false,

  /** Measured bytes, or null until the quiet-period snapshot runs. */
  bytes: null,

  /** The URL the bytes were measured on. */
  url: null,

  /**
   * Decide whether this pageview is sampled and prepare the browser for it.
   */
  init() {
    const sampleRate = Math.min(1, Math.max(0, Number(burst.options.page_weight_sample_rate) || 0));
    // Purely client-side: a server-computed forced-eligibility flag would get
    // baked into any full-page cache (Rocket/LiteSpeed/Varnish) and served
    // statically to every subsequent visitor regardless of the page's real
    // measurement state, so eligibility is decided fresh per browser instead.
    this.eligible = Math.random() < sampleRate; // nosemgrep

    // Only a sampled pageview reads the resource entries, so only it needs a
    // buffer larger than the default 250; everyone else keeps the site's own size.
    if (this.eligible && performance?.setResourceTimingBufferSize) {
      performance.setResourceTimingBufferSize(1000);
    }
  },

  /**
   * Whether this pageview still wants a page weight sample: it was picked for
   * sampling and nothing has delivered one yet. Re-checked around every wait,
   * because an SPA navigation can end sampling for this pageview mid-flight.
   *
   * @returns {boolean}
   */
  isWanted() {
    return this.eligible && !this.sampled;
  },

  /**
   * Whether a measured sample is sitting here undelivered. Delivery has exactly
   * two chances — the exit hit and an SPA navigation flush — and both ask this,
   * so it is spelled once.
   *
   * The bytes check is a loose != null on purpose: a strict !== null lets
   * undefined through. The exit hit then reports { url: this.url } with the url
   * also undefined, which overwrites location.href and costs that hit its time
   * on page.
   *
   * @returns {boolean}
   */
  hasUndelivered() {
    return this.isWanted() && this.bytes != null;
  },

  /**
   * Measure after completed resource entries have been quiet for three seconds.
   * Resource Timing does not expose a reliable count of every pending request,
   * so late-starting resources remain part of the documented lower bound.
   *
   * @param {Function} [onSampleStored] Called once a snapshot has been stored.
   */
  async measureAfterQuietPeriod(onSampleStored) {
    if (!this.isWanted()) {
      return;
    }

    // A prerendered page loads fully while document.visibilityState is still
    // 'hidden', so a sample stored during prerender would trip the hidden-send
    // path: its exit hit races the create hit (both parked on this same
    // promise) and can reach the server first, and it would measure pages the
    // visitor never activates. Arm the quiet period only on a page that is
    // being rendered for real; on a normal load the promise is already
    // resolved and this changes nothing.
    await pageIsRendered;
    if (!this.isWanted()) {
      return;
    }

    const quietPeriodMs = 3000;
    const maxWaitMs = 15000;
    let quietTimer = null;
    let maxWaitTimer = null;
    let observer = null;
    let measurementQueued = false;

    const cleanup = () => {
      if (quietTimer !== null) {
        clearTimeout(quietTimer);
      }

      if (maxWaitTimer !== null) {
        clearTimeout(maxWaitTimer);
      }
      observer?.disconnect();
    };

    const measure = () => {
      if (measurementQueued) {
        return;
      }

      measurementQueued = true;

      cleanup();

      // Re-checked after the wait: a URL change can have ended sampling for this
      // pageview while the quiet period was still running.
      if (!this.isWanted()) {
        return;
      }

      // Snapshot page weight and URL at the quiet moment; delivery happens with
      // the exit hit, so no extra request is needed. Use currentUrl instead of
      // location.href so URL changes via pushState/replaceState don't associate
      // bytes measured for the original pageview with the new URL.
      const bytes = this.readBytes();
      if (bytes !== null) {
        this.bytes = bytes;
        this.url = burst.tracking.currentUrl;
        // A sample can arrive after an exit hit has already gone out: a tab
        // opened in the background is hidden from the start, so its exit hit
        // leaves before the quiet period and carries nothing. Closing that tab
        // without ever focusing it never resets the one-shot latch, and pagehide
        // is the sample's last chance — so reset the latch here, where there is
        // new information to send.
        onSampleStored?.();
      }
    };

    const resetQuietTimer = () => {
      if (quietTimer !== null) {
        clearTimeout(quietTimer);
      }
      quietTimer = setTimeout(measure, quietPeriodMs);
    };

    if (typeof PerformanceObserver === 'function') {
      try {
        observer = new PerformanceObserver((list) => {
          if (list.getEntries().length > 0) {
            resetQuietTimer();
          }
        });
        observer.observe({ type: 'resource' });
      } catch {
        observer = null;
      }
    }

    resetQuietTimer();
    maxWaitTimer = setTimeout(measure, maxWaitMs);
  },

  /**
   * Read initial page weight (navigation + resource transfer sizes) now. Returns
   * null when Resource Timing has no navigation entry to anchor the measurement.
   * Called for the quiet-period snapshot.
   *
   * @returns {number|null}
   */
  readBytes() {
    const nav = performance.getEntriesByType('navigation')[0];
    if (!nav) return null;

    return nav.transferSize +
      performance.getEntriesByType('resource')
        .reduce((total, resource) => total + (resource.transferSize || 0), 0);
  },

  /**
   * Hand the undelivered sample to the hit being sent, once.
   *
   * @returns {{page_weight_bytes?: number}} The hit data to merge in.
   */
  takeSample() {
    // Only the quiet-period snapshot is trusted: it captures initial page weight
    // after load, not the whole visit's transfers (lazy-loaded images, infinite
    // scroll, video). A visit that exits before the quiet period fires has no
    // reliable weight (the load may still be in flight), so it contributes no
    // sample rather than an undercount that would drag the per-URL average down.
    if (!this.hasUndelivered()) {
      return {};
    }

    this.sampled = true;

    return {
      page_weight_bytes: this.bytes
    };
  },

  /**
   * End sampling for this pageview: an SPA navigation is not a page load, so
   * the pages it shows are never sampled.
   */
  reset() {
    this.eligible = false;
    this.bytes = null;
    this.url = null;
  },
};

burst.pageWeight.init();

/**
 * Update the tracked hit
 * Mostly used for updating time spent on a page
 * Also used for updating the UID (from fingerprint to a cookie)
 */
async function burst_update_hit(
	update_uid = false,
	force = false,
	extraData = {},
	include_page_weight = false,
) {
	await pageIsRendered;
	if (burst_is_user_agent() || burst_is_do_not_track() || !burst_has_tracking_consent()) {
		burst.events?.clearQueue();
		return;
	}
	if (burst.tracking.isInitialHit) {
		burst_track_hit(extraData);
		return;
	}

	// If we don't force the update, we only update the hit if 300ms have passed since the last update
	if (!force && Date.now() - burst.tracking.lastUpdateTimestamp < 300) return;

	document.dispatchEvent(
		new CustomEvent("burst_before_update_hit", { detail: burst }),
	);

	const [time, id] = await Promise.all([
		burst_get_time_on_page(),
		burst.options.privacy_level === 'private_mode'
			? Promise.resolve(update_uid ? [false, false] : false)
			: update_uid
				? Promise.all([burst_uid(), burst_fingerprint()])
				: burst_use_cookies()
					? burst_uid()
					: burst_fingerprint(),
	]);

	burst_update_scroll_metrics();

	const data = {
		fingerprint: update_uid ? id[1] : burst_use_cookies() ? false : id,
		uid: update_uid ? id[0] : burst_use_cookies() ? id : false,
		url: location.href,
		time_on_page: time,
		max_scroll: burstMaxScroll,
		dwell_zones: JSON.stringify(burstDwellTimePerZone),
		completed_goals: burst.goals.completed,
		should_load_ecommerce: burst.should_load_ecommerce,
		...(include_page_weight ? burst.pageWeight.takeSample() : {}),
		...extraData,
	};

	if (time > 0 || data.uid !== false || data.page_weight_bytes !== undefined) {
		// Take the queue only once a request is going out, so an event triggered
		// while it is in flight goes with the next hit. Sent once, never resent.
		data.events = burst.events?.takeQueue() ?? [];
		await burst_api_request({ data: data });
		burst.tracking.lastUpdateTimestamp = Date.now();
	}
}
/**
 * Track a hit
 *
 */
async function burst_track_hit(extraData = {}) {
  const isInitialHit = burst.tracking.isInitialHit;
  burst.tracking.isInitialHit = false;
  await pageIsRendered;
  if ( !isInitialHit ) {
    burst_update_hit(false, false, extraData);
    return;
  }
  if (burst_is_user_agent() || burst_is_do_not_track() || !burst_has_tracking_consent()) {
    burst.tracking.isInitialHit = true;
    burst.events?.clearQueue();
    return;
  }

  // Restore the flag when throttled, as the consent guard above does: returning
  // with the flag already cleared would turn the next hit into an update and
  // permanently lose this page's create hit.
  if (Date.now() - burst.tracking.lastUpdateTimestamp < 300) {
    burst.tracking.isInitialHit = true;
    return;
  }

  document.dispatchEvent(new CustomEvent('burst_before_track_hit', { detail: burst }));

  const [time, id] = await Promise.all([
    burst_get_time_on_page(),
    burst.options.privacy_level === 'private_mode'
      ? Promise.resolve(false)
      : burst_use_cookies() ? burst_uid() : burst_fingerprint()
  ]);

  //wait for body document to resolve.
  let attempts = 0;
  const maxAttempts = 200; // 200 * 2ms = 400ms max, 2ms should be enough to get the body in almost all cases.
  while ( !document.body && attempts++ < maxAttempts ) {
    await new Promise(resolve => setTimeout(resolve, 2));
  }

  if ( !document.body ) {
    console.warn('Burst: missing page_id attribute, not able to resolve body element.');
  }

  burst_update_scroll_metrics();

  const burstSearchParams = new URLSearchParams(location.search);
  const data = {
    uid: burst_use_cookies() ? id : false,
    fingerprint: burst_use_cookies() ? false : id,
    url: location.href,
    referrer_url: document.referrer,
    user_agent: navigator.userAgent || 'unknown',
    device_resolution: `${window.screen.width * window.devicePixelRatio}x${window.screen.height * window.devicePixelRatio}`,
    time_on_page: time,
    max_scroll: burstMaxScroll,
    dwell_zones: JSON.stringify(burstDwellTimePerZone),
    completed_goals: burst.goals.completed,
    // Taken before burst_track_hit is dispatched, so events a listener triggers go with the next hit.
    events: burst.events?.takeQueue() ?? [],
    page_id: document.body?.dataset?.burst_id ?? document.body?.dataset?.b_id ?? 0,
    page_type: document.body?.dataset?.burst_type ?? document.body?.dataset?.b_type ?? '',
    should_load_ecommerce: burst.should_load_ecommerce,
    search_term: burstSearchParams.get('s') || '',
    ...extraData,
  };

  document.dispatchEvent(new CustomEvent('burst_track_hit', { detail: data }));
  await burst_api_request({ method: 'POST', data: data });
  burst.tracking.lastUpdateTimestamp = Date.now();
}
/**
 * Initialize events
 * @returns {Promise<void>}
 *
 * More information on why we just use visibilitychange instead of beforeunload
 * to update the hits:
 * https://www.igvita.com/2015/11/20/dont-lose-user-and-app-state-use-page-visibility/
 *     https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event
 *     https://xgwang.me/posts/you-may-not-know-beacon/#the-confusion
 *
 */
function burst_init_events() {
  burst.tracking.currentUrl = location.href;

  // The single exit delivery path: with the page-weight sample no longer sent
  // by its own beacon, the exit hit carries both time-on-page and the sample.
  // Registered for visibilitychange AND pagehide so iOS Safari and bfcache
  // navigations (which can skip visibilitychange) still flush — the two can
  // both fire for the same exit, so a one-shot latch stops that from sending
  // the hit twice. The latch resets whenever the page becomes visible again
  // (tab switch back, or pageshow for a page restored from bfcache), so every
  // later hide still sends its update, and when a page weight snapshot lands
  // after an exit hit has gone out (see resetExitHit below).

  let exitHitSent = false;
  // Clears the latch so exactly one more exit hit can go out. Every reset of
  // the latch goes through here; also passed to the page weight snapshot, which
  // cannot see this closure.
  const resetExitHit = () => {
    exitHitSent = false;
  };

  const sendExitHit = () => {
    if (exitHitSent) {
      return;
    }
    exitHitSent = true;
    const includePageWeight = burst.pageWeight.hasUndelivered();
    // The sample is reported against the URL it was actually measured on
    // (snapshotted alongside the bytes), not wherever location.href points by
    // the time the visitor leaves — see burst.pageWeight.measureAfterQuietPeriod().
    const extraData = includePageWeight ? { url: burst.pageWeight.url } : {};
    // Args: (update_uid=false, force, extraData, include_page_weight).
    // includePageWeight is passed as BOTH force and include_page_weight: when a
    // sample is still undelivered we must bypass the 300ms update throttle so
    // the exit hit is guaranteed to carry it (this is the sample's only
    // delivery path). With no pending sample, force stays false and this is a
    // normal best-effort time-on-page update, subject to the throttle.
    burst_update_hit(false, includePageWeight, extraData, includePageWeight);
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden' || document.visibilityState === 'unloaded') {
      sendExitHit();
    } else if (document.visibilityState === 'visible') {
      resetExitHit();
    }
  };

  const processUrlChange = async () => {
    // Same-URL history updates (scroll restoration, UTM strippers doing a
    // same-path replaceState) are not navigations: resetting here would drop
    // this pageview's sample, which now has only the exit hit to ride on.
    if (burst.tracking.currentUrl === location.href) {
      return;
    }

    const previousUrl = burst.tracking.currentUrl;
    const currentUrl = location.href;
    burst.tracking.currentUrl = currentUrl;

    // Flush the finished page's snapshot to a final update hit attributed to
    // the old URL (page weight is queued server-side per page_url) before
    // eligibility resets. Awaited so it lands as an update while isInitialHit
    // is still false — flipping it first would turn this into a new track hit.
    // Skipped when the quiet-period snapshot has not run yet: there is no
    // sample to deliver, so a forced update would only cost a request.
    if (burst.pageWeight.hasUndelivered()) {
      // The flush stamps lastUpdateTimestamp; put the previous value back so
      // the 300ms throttle in burst_track_hit() does not swallow the new
      // page's create hit sent right below.
      const lastUpdateBeforeFlush = burst.tracking.lastUpdateTimestamp;
      await burst_update_hit(false, true, { url: previousUrl }, true);
      if (burst.tracking.currentUrl !== currentUrl) {
        return;
      }
      burst.tracking.lastUpdateTimestamp = lastUpdateBeforeFlush;
    }

    burst.pageWeight.reset();

    burst.tracking.isInitialHit = true;
    burst_track_hit();
  };

  // A single navigation often arrives as several history calls in one task: a
  // router pushes '/a' and immediately canonicalizes it to '/a/'. Each call
  // re-arms isInitialHit and sends its own create hit, and the 300ms throttle
  // in burst_track_hit() cannot stop the second because it is checked after an
  // await — both runs read the same pre-navigation timestamp — so the pageview
  // is counted twice. Coalescing to one run per task collapses the burst, and
  // the run then reads the URL the router settled on rather than the transient
  // one.
  let urlChangeQueued = false;
  const handleUrlChange = () => {
    // SPA tracking off: the URL changed but Burst keeps the same pageview, so
    // page-weight sampling for the original load must continue — do not reset.
    if (!burst.options.track_url_change) {
      return;
    }

    if (urlChangeQueued) {
      return;
    }

    urlChangeQueued = true;

    Promise.resolve().then(() => {
      urlChangeQueued = false;
      processUrlChange();
    });
  };

  const getExternalLinkUrl = (anchorElement) => {
		const href = anchorElement?.getAttribute?.("href");
		if (!href || href.startsWith("#")) return false;

		let targetUrl;
		try {
			targetUrl = new URL(anchorElement.href, window.location.href);
		} catch (error) {
			return false;
		}

		if (!["http:", "https:"].includes(targetUrl.protocol)) return false;
		if (targetUrl.origin === window.location.origin) return false;

		return targetUrl.href;
	};

	const shouldWaitForNavigation = (event, anchorElement) => {
		if (event.defaultPrevented) return false;
		if (event.button !== 0) return false;
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
			return false;
		if (anchorElement.hasAttribute("download")) return false;

		const linkTarget = (
			anchorElement.getAttribute("target") || ""
		).toLowerCase();
		return !linkTarget || linkTarget === "_self";
	};

  // Handle external link clicks for Elementor loading animations/lazy loading
  const handleExternalLinkClick = (e) => {
    const target = e.target.closest("a[href]");
    if (!target) return;

    if (!burst.options.track_external_links) return;

		const externalLinkUrl = getExternalLinkUrl(target);
		if (!externalLinkUrl) return;

		const trackingPayload = {
			external_link_url: externalLinkUrl,
		};

		if (burst.options.beacon_enabled || !shouldWaitForNavigation(e, target)) {
			burst_update_hit(false, true, trackingPayload);
			return;
		}

    e.preventDefault();
		const fallbackTimeoutMs = 250;
		let didNavigate = false;
		const navigate = () => {
			if (didNavigate) return;
			didNavigate = true;
			window.location.assign(target.href);
		};

		setTimeout(navigate, fallbackTimeoutMs);
		burst_update_hit(false, true, trackingPayload).finally(navigate);

    return;
  };

  // Attach event handlers
  if (burst.options.enable_turbo_mode) {
    if (document.readyState !== 'loading') {
      burst_track_hit();
    } else {
      // Note: 'load' does not fire on document (only on window), so listen for
      // DOMContentLoaded, which fires as soon as parsing completes - the same
      // moment a deferred script would have run.
      document.addEventListener('DOMContentLoaded', burst_track_hit, { once: true });
    }
  } else {
    burst_track_hit();
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pagehide', sendExitHit);
  // A bfcache restore can be followed by a later, genuine exit — let that one
  // send again.
  window.addEventListener('pageshow', resetExitHit);
  if (document.readyState === 'complete') {
    burst.pageWeight.measureAfterQuietPeriod(() => {
      resetExitHit();
      if (document.visibilityState === 'hidden') {
        sendExitHit();
      }
    });
  } else {
    window.addEventListener('load', () => burst.pageWeight.measureAfterQuietPeriod(() => {
      resetExitHit();
      if (document.visibilityState === 'hidden') {
        sendExitHit();
      }
    }), { once: true });
  }
  document.addEventListener('click', handleExternalLinkClick, true); // Use capture phase to ensure we catch the event
  document.addEventListener('burst_fire_hit', () => burst_track_hit());
  document.addEventListener('burst_enable_cookies', () => {
    burst_enable_cookies();
    burst_update_hit(true);
  });

  const originalPushState = history.pushState;
  history.pushState = function () {
    originalPushState.apply(this, arguments);
    handleUrlChange();
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function () {
    originalReplaceState.apply(this, arguments);
    handleUrlChange();
  };

  window.addEventListener('popstate', handleUrlChange);
}

const burst_maybe_init = () => {
  if (burst_consent_state() !== 'yes') return;
  if (burst.tracking.initialized) {
    burst_track_hit();
    return;
  }
  // no double listeners
  burst.tracking.initialized = true;
  burst_init_events();
};

document.addEventListener('wp_consent_type_defined', burst_maybe_init);
document.addEventListener('wp_listen_for_consent_change', e => {
  const detail = e.detail;
  const isAllowed = (detail && (detail.statistics === 'allow' || detail['statistics'] === 'allow'))
    || (typeof wp_has_consent === 'function' && wp_has_consent('statistics'));
  if (isAllowed) {
    burst.cache.useCookies = null;
    burst_maybe_init();
  }
});

// events.js loads async next to this script and needs burst.options and the
// consent check: whichever of the two loads last initializes it.
burst.isLoaded = true;
if (burst.options.enable_custom_events) {
  burst.events?.init();
} else {
  // Disabled: events.js isn't loaded, so keep burst.event() calls from throwing.
  burst.event = () => {
    if (burst.options.debug) {
      console.warn('Burst: custom events are not enabled, the event was not recorded.');
    }
  };
}

burst_maybe_init();

window.burst_uid = burst_uid;
window.burst_use_cookies = burst_use_cookies;
window.burst_fingerprint = burst_fingerprint;
window.burst_update_hit = burst_update_hit;
