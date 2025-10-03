!function(e,n){"object"==typeof exports&&"undefined"!=typeof module?n(exports):"function"==typeof define&&define.amd?define(["exports"],n):n((e="undefined"!=typeof globalThis?globalThis:e||self).ThumbmarkJS={})}(this,(function(e){"use strict";const n="https://api.thumbmarkjs.com",t={exclude:[],include:[],stabilize:["private","iframe"],logging:!0,timeout:5e3,cache_api_call:!0,performance:!1};let o={...t};const r={private:[{exclude:["canvas"],browsers:["firefox","safari>=17","brave"]},{exclude:["audio"],browsers:["samsungbrowser","safari"]},{exclude:["fonts"],browsers:["firefox"]},{exclude:["audio.sampleHash","hardware.deviceMemory","header.acceptLanguage.q","system.hardwareConcurrency","plugins"],browsers:["brave"]},{exclude:["tls.extensions"],browsers:["firefox","chrome","safari"]},{exclude:["header.acceptLanguage"],browsers:["edge","chrome"]}],iframe:[{exclude:["permissions.camera","permission.geolocation","permissions.microphone","system.applePayVersion","system.cookieEnabled"],browsers:["safari"]}],vpn:[{exclude:["ip"]}]};function i(e){let n=0;for(let t=0;t<e.length;++t)n+=Math.abs(e[t]);return n}function a(e,n,t){let o=[];for(let n=0;n<e[0].data.length;n++){let t=[];for(let o=0;o<e.length;o++)t.push(e[o].data[n]);o.push(s(t))}const r=new Uint8ClampedArray(o);return new ImageData(r,n,t)}function s(e){if(0===e.length)return 0;const n={};for(const t of e)n[t]=(n[t]||0)+1;let t=e[0];for(const e in n)n[e]>n[t]&&(t=parseInt(e,10));return t}function c(e){return e^=e>>>16,e=Math.imul(e,2246822507),e^=e>>>13,e=Math.imul(e,3266489909),(e^=e>>>16)>>>0}const l=new Uint32Array([597399067,2869860233,951274213,2716044179]);function u(e,n){return e<<n|e>>>32-n}function d(e,n=0){var t;if(n=n?0|n:0,"string"==typeof e&&(t=e,e=(new TextEncoder).encode(t).buffer),!(e instanceof ArrayBuffer))throw new TypeError("Expected key to be ArrayBuffer or string");const o=new Uint32Array([n,n,n,n]);!function(e,n){const t=e.byteLength/16|0,o=new Uint32Array(e,0,4*t);for(let e=0;e<t;e++){const t=o.subarray(4*e,4*(e+1));t[0]=Math.imul(t[0],l[0]),t[0]=u(t[0],15),t[0]=Math.imul(t[0],l[1]),n[0]=n[0]^t[0],n[0]=u(n[0],19),n[0]=n[0]+n[1],n[0]=Math.imul(n[0],5)+1444728091,t[1]=Math.imul(t[1],l[1]),t[1]=u(t[1],16),t[1]=Math.imul(t[1],l[2]),n[1]=n[1]^t[1],n[1]=u(n[1],17),n[1]=n[1]+n[2],n[1]=Math.imul(n[1],5)+197830471,t[2]=Math.imul(t[2],l[2]),t[2]=u(t[2],17),t[2]=Math.imul(t[2],l[3]),n[2]=n[2]^t[2],n[2]=u(n[2],15),n[2]=n[2]+n[3],n[2]=Math.imul(n[2],5)+2530024501,t[3]=Math.imul(t[3],l[3]),t[3]=u(t[3],18),t[3]=Math.imul(t[3],l[0]),n[3]=n[3]^t[3],n[3]=u(n[3],13),n[3]=n[3]+n[0],n[3]=Math.imul(n[3],5)+850148119}}(e,o),function(e,n){const t=e.byteLength/16|0,o=e.byteLength%16,r=new Uint32Array(4),i=new Uint8Array(e,16*t,o);switch(o){case 15:r[3]=r[3]^i[14]<<16;case 14:r[3]=r[3]^i[13]<<8;case 13:r[3]=r[3]^i[12],r[3]=Math.imul(r[3],l[3]),r[3]=u(r[3],18),r[3]=Math.imul(r[3],l[0]),n[3]=n[3]^r[3];case 12:r[2]=r[2]^i[11]<<24;case 11:r[2]=r[2]^i[10]<<16;case 10:r[2]=r[2]^i[9]<<8;case 9:r[2]=r[2]^i[8],r[2]=Math.imul(r[2],l[2]),r[2]=u(r[2],17),r[2]=Math.imul(r[2],l[3]),n[2]=n[2]^r[2];case 8:r[1]=r[1]^i[7]<<24;case 7:r[1]=r[1]^i[6]<<16;case 6:r[1]=r[1]^i[5]<<8;case 5:r[1]=r[1]^i[4],r[1]=Math.imul(r[1],l[1]),r[1]=u(r[1],16),r[1]=Math.imul(r[1],l[2]),n[1]=n[1]^r[1];case 4:r[0]=r[0]^i[3]<<24;case 3:r[0]=r[0]^i[2]<<16;case 2:r[0]=r[0]^i[1]<<8;case 1:r[0]=r[0]^i[0],r[0]=Math.imul(r[0],l[0]),r[0]=u(r[0],15),r[0]=Math.imul(r[0],l[1]),n[0]=n[0]^r[0]}}(e,o),function(e,n){n[0]=n[0]^e.byteLength,n[1]=n[1]^e.byteLength,n[2]=n[2]^e.byteLength,n[3]=n[3]^e.byteLength,n[0]=n[0]+n[1]|0,n[0]=n[0]+n[2]|0,n[0]=n[0]+n[3]|0,n[1]=n[1]+n[0]|0,n[2]=n[2]+n[0]|0,n[3]=n[3]+n[0]|0,n[0]=c(n[0]),n[1]=c(n[1]),n[2]=c(n[2]),n[3]=c(n[3]),n[0]=n[0]+n[1]|0,n[0]=n[0]+n[2]|0,n[0]=n[0]+n[3]|0,n[1]=n[1]+n[0]|0,n[2]=n[2]+n[0]|0,n[3]=n[3]+n[0]|0}(e,o);const r=new Uint8Array(o.buffer);return Array.from(r).map((e=>e.toString(16).padStart(2,"0"))).join("")}const m=280;function h(e,n){return new Promise((t=>setTimeout(t,e,n)))}const f=["Arial","Arial Black","Arial Narrow","Arial Rounded MT","Arimo","Archivo","Barlow","Bebas Neue","Bitter","Bookman","Calibri","Cabin","Candara","Century","Century Gothic","Comic Sans MS","Constantia","Courier","Courier New","Crimson Text","DM Mono","DM Sans","DM Serif Display","DM Serif Text","Dosis","Droid Sans","Exo","Fira Code","Fira Sans","Franklin Gothic Medium","Garamond","Geneva","Georgia","Gill Sans","Helvetica","Impact","Inconsolata","Indie Flower","Inter","Josefin Sans","Karla","Lato","Lexend","Lucida Bright","Lucida Console","Lucida Sans Unicode","Manrope","Merriweather","Merriweather Sans","Montserrat","Myriad","Noto Sans","Nunito","Nunito Sans","Open Sans","Optima","Orbitron","Oswald","Pacifico","Palatino","Perpetua","PT Sans","PT Serif","Poppins","Prompt","Public Sans","Quicksand","Rajdhani","Recursive","Roboto","Roboto Condensed","Rockwell","Rubik","Segoe Print","Segoe Script","Segoe UI","Sora","Source Sans Pro","Space Mono","Tahoma","Taviraj","Times","Times New Roman","Titillium Web","Trebuchet MS","Ubuntu","Varela Round","Verdana","Work Sans"],p=["monospace","sans-serif","serif"];function g(e,n){if(!e)throw new Error("Canvas context not supported");return e.font=`72px ${n}`,e.measureText("WwMmLli0Oo").width}function v(){var e;const n=document.createElement("canvas"),t=null!==(e=n.getContext("webgl"))&&void 0!==e?e:n.getContext("experimental-webgl");if(t&&"getParameter"in t)try{const e=(t.getParameter(t.VENDOR)||"").toString(),n=(t.getParameter(t.RENDERER)||"").toString();let o={vendor:e,renderer:n,version:(t.getParameter(t.VERSION)||"").toString(),shadingLanguageVersion:(t.getParameter(t.SHADING_LANGUAGE_VERSION)||"").toString()};if(!n.length||!e.length){const e=t.getExtension("WEBGL_debug_renderer_info");if(e){const n=(t.getParameter(e.UNMASKED_VENDOR_WEBGL)||"").toString(),r=(t.getParameter(e.UNMASKED_RENDERER_WEBGL)||"").toString();n&&(o.vendorUnmasked=n),r&&(o.rendererUnmasked=r)}}return o}catch(e){}return"undefined"}function w(){const e=new Float32Array(1),n=new Uint8Array(e.buffer);return e[0]=1/0,e[0]=e[0]-e[0],n[3]}const y=(e,n,t,o)=>{const r=(t-n)/o;let i=0;for(let t=0;t<o;t++){i+=e(n+(t+.5)*r)}return i*r};function b(e,n){const t={};return n.forEach((n=>{const o=function(e){if(0===e.length)return null;const n={};e.forEach((e=>{const t=String(e);n[t]=(n[t]||0)+1}));let t=e[0],o=1;return Object.keys(n).forEach((e=>{n[e]>o&&(t=e,o=n[e])})),t}(e.map((e=>n in e?e[n]:void 0)).filter((e=>void 0!==e)));o&&(t[n]=o)})),t}const S=["accelerometer","accessibility","accessibility-events","ambient-light-sensor","background-fetch","background-sync","bluetooth","camera","clipboard-read","clipboard-write","device-info","display-capture","gyroscope","geolocation","local-fonts","magnetometer","microphone","midi","nfc","notifications","payment-handler","persistent-storage","push","speaker","storage-access","top-level-storage-access","window-management","query"];function M(){var e,n,t,o,r,i;if("undefined"==typeof navigator)return{name:"unknown",version:"unknown"};const a=navigator.userAgent,s=[/(?<name>SamsungBrowser)\/(?<version>\d+(?:\.\d+)+)/,/(?<name>EdgA|EdgiOS|Edg)\/(?<version>\d+(?:\.\d+)+)/,/(?<name>OPR|OPX)\/(?<version>\d+(?:\.\d+)+)/,/Opera[\s\/](?<version>\d+(?:\.\d+)+)/,/Opera Mini\/(?<version>\d+(?:\.\d+)+)/,/Opera Mobi\/(?<version>\d+(?:\.\d+)+)/,/(?<name>Vivaldi)\/(?<version>\d+(?:\.\d+)+)/,/(?<name>Brave)\/(?<version>\d+(?:\.\d+)+)/,/(?<name>CriOS)\/(?<version>\d+(?:\.\d+)+)/,/(?<name>FxiOS)\/(?<version>\d+(?:\.\d+)+)/,/(?<name>Chrome|Chromium)\/(?<version>\d+(?:\.\d+)+)/,/(?<name>Firefox|Waterfox|Iceweasel|IceCat)\/(?<version>\d+(?:\.\d+)+)/,/Version\/(?<version1>[\d.]+).*Safari\/[\d.]+|(?<name>Safari)\/(?<version2>[\d.]+)/,/(?<name>MSIE|Trident|IEMobile).+?(?<version>\d+(?:\.\d+)+)/,/(?<name>[A-Za-z]+)\/(?<version>\d+(?:\.\d+)+)/],c={edg:"Edge",edga:"Edge",edgios:"Edge",opr:"Opera",opx:"Opera",crios:"Chrome",fxios:"Firefox",samsung:"SamsungBrowser",vivaldi:"Vivaldi",brave:"Brave"};for(const l of s){const s=a.match(l);if(s){let a=null===(e=s.groups)||void 0===e?void 0:e.name,u=(null===(n=s.groups)||void 0===n?void 0:n.version)||(null===(t=s.groups)||void 0===t?void 0:t.version1)||(null===(o=s.groups)||void 0===o?void 0:o.version2);if(a||!(null===(r=s.groups)||void 0===r?void 0:r.version1)&&!(null===(i=s.groups)||void 0===i?void 0:i.version2)||(a="Safari"),!a&&l.source.includes("Opera Mini")&&(a="Opera Mini"),!a&&l.source.includes("Opera Mobi")&&(a="Opera Mobi"),!a&&l.source.includes("Opera")&&(a="Opera"),!a&&s[1]&&(a=s[1]),!u&&s[2]&&(u=s[2]),a){return{name:c[a.toLowerCase()]||a,version:u||"unknown"}}}}return{name:"unknown",version:"unknown"}}function P(){if("undefined"==typeof navigator||!navigator.userAgent)return!1;const e=navigator.userAgent;return/Mobi|Android|iPhone|iPod|IEMobile|Opera Mini|Opera Mobi|webOS|BlackBerry|Windows Phone/i.test(e)&&!/iPad/i.test(e)}function E(){let e=[];const n={"prefers-contrast":["high","more","low","less","forced","no-preference"],"any-hover":["hover","none"],"any-pointer":["none","coarse","fine"],pointer:["none","coarse","fine"],hover:["hover","none"],update:["fast","slow"],"inverted-colors":["inverted","none"],"prefers-reduced-motion":["reduce","no-preference"],"prefers-reduced-transparency":["reduce","no-preference"],scripting:["none","initial-only","enabled"],"forced-colors":["active","none"]};return Object.keys(n).forEach((t=>{n[t].forEach((n=>{matchMedia(`(${t}: ${n})`).matches&&e.push(`${t}: ${n}`)}))})),e}function A(){if("https:"===window.location.protocol&&"function"==typeof window.ApplePaySession)try{const e=window.ApplePaySession.supportsVersion;for(let n=15;n>0;n--)if(e(n))return n}catch(e){return 0}return 0}const x="SamsungBrowser"!==M().name?1:3;let C,T=null;const k={audio:async function(){return async function(){return new Promise(((e,n)=>{try{const n=44100,t=5e3,o=new(window.OfflineAudioContext||window.webkitOfflineAudioContext)(1,t,n),r=o.createBufferSource(),a=o.createOscillator();a.frequency.value=1e3;const s=o.createDynamicsCompressor();let c;s.threshold.value=-50,s.knee.value=40,s.ratio.value=12,s.attack.value=0,s.release.value=.2,a.connect(s),s.connect(o.destination),a.start(),o.oncomplete=n=>{c=n.renderedBuffer.getChannelData(0),e({sampleHash:i(c),maxChannels:o.destination.maxChannelCount,channelCountMode:r.channelCountMode})},o.startRendering()}catch(e){console.error("Error creating audio fingerprint:",e),n(e)}}))}()},canvas:async function(){return new Promise((e=>{const n=Array.from({length:3},(()=>function(){const e=document.createElement("canvas"),n=e.getContext("2d");if(!n)return new ImageData(1,1);e.width=m,e.height=20;const t=n.createLinearGradient(0,0,e.width,e.height);t.addColorStop(0,"red"),t.addColorStop(1/6,"orange"),t.addColorStop(2/6,"yellow"),t.addColorStop(.5,"green"),t.addColorStop(4/6,"blue"),t.addColorStop(5/6,"indigo"),t.addColorStop(1,"violet"),n.fillStyle=t,n.fillRect(0,0,e.width,e.height);const o="Random Text WMwmil10Oo";n.font="23.123px Arial",n.fillStyle="black",n.fillText(o,-5,15),n.fillStyle="rgba(0, 0, 255, 0.5)",n.fillText(o,-3.3,17.7),n.beginPath(),n.moveTo(0,0),n.lineTo(2*e.width/7,e.height),n.strokeStyle="white",n.lineWidth=2,n.stroke();const r=n.getImageData(0,0,e.width,e.height);return r}()));e({commonPixelsHash:d(a(n,m,20).data.toString()).toString()})}))},fonts:async function(e){return new Promise(((e,n)=>{try{!async function(e){for(var n;!document.body;)await h(50);const t=document.createElement("iframe");t.setAttribute("frameBorder","0");const o=t.style;o.setProperty("position","fixed"),o.setProperty("display","block","important"),o.setProperty("visibility","visible"),o.setProperty("border","0"),o.setProperty("opacity","0"),t.src="about:blank",document.body.appendChild(t);const r=t.contentDocument||(null===(n=t.contentWindow)||void 0===n?void 0:n.document);if(!r)throw new Error("Iframe document is not accessible");e({iframe:r}),setTimeout((()=>{document.body.removeChild(t)}),0)}((async({iframe:n})=>{const t=n.createElement("canvas").getContext("2d"),o=p.map((e=>g(t,e)));let r={};f.forEach((e=>{const n=g(t,e);o.includes(n)||(r[e]=n)})),e(r)}))}catch(e){n({error:"unsupported"})}}))},hardware:function(){return new Promise(((e,n)=>{const t=void 0!==navigator.deviceMemory?navigator.deviceMemory:0,o=window.performance&&window.performance.memory?window.performance.memory:0;e({videocard:v(),architecture:w(),deviceMemory:t.toString()||"undefined",jsHeapSizeLimit:o.jsHeapSizeLimit||0})}))},locales:function(){return new Promise((e=>{e({languages:navigator.language,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone})}))},math:function(){return new Promise((e=>{e({acos:Math.acos(.5),asin:y(Math.asin,-1,1,97),cos:y(Math.cos,0,Math.PI,97),largeCos:Math.cos(1e20),largeSin:Math.sin(1e20),largeTan:Math.tan(1e20),sin:y(Math.sin,-Math.PI,Math.PI,97),tan:y(Math.tan,0,2*Math.PI,97)})}))},permissions:async function(e){let n=(null==e?void 0:e.permissions_to_check)||S;const t=Array.from({length:3},(()=>async function(e){const n={};for(const t of e)try{const e=await navigator.permissions.query({name:t});n[t]=e.state.toString()}catch(e){}return n}(n)));return Promise.all(t).then((e=>b(e,n)))},plugins:async function(){const e=[];if(navigator.plugins)for(let n=0;n<navigator.plugins.length;n++){const t=navigator.plugins[n];e.push([t.name,t.filename,t.description].join("|"))}return new Promise((n=>{n({plugins:e})}))},screen:function(){return new Promise((e=>{const n={is_touchscreen:navigator.maxTouchPoints>0,maxTouchPoints:navigator.maxTouchPoints,colorDepth:screen.colorDepth,mediaMatches:E()};P()&&navigator.maxTouchPoints>0&&(n.resolution=function(){const e=window.screen.width,n=window.screen.height,t=Math.max(e,n).toString(),o=Math.min(e,n).toString();return`${t}x${o}`}()),e(n)}))},system:function(){return new Promise((e=>{const n=M();e({platform:window.navigator.platform,productSub:navigator.productSub,product:navigator.product,useragent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,browser:{name:n.name,version:n.version},mobile:P(),applePayVersion:A(),cookieEnabled:window.navigator.cookieEnabled})}))},webgl:async function(){"undefined"!=typeof document&&(C=document.createElement("canvas"),C.width=200,C.height=100,T=C.getContext("webgl"));try{if(!T)throw new Error("WebGL not supported");const e=Array.from({length:x},(()=>function(){try{if(!T)throw new Error("WebGL not supported");const e="\n          attribute vec2 position;\n          void main() {\n              gl_Position = vec4(position, 0.0, 1.0);\n          }\n      ",n="\n          precision mediump float;\n          void main() {\n              gl_FragColor = vec4(0.812, 0.195, 0.553, 0.921); // Set line color\n          }\n      ",t=T.createShader(T.VERTEX_SHADER),o=T.createShader(T.FRAGMENT_SHADER);if(!t||!o)throw new Error("Failed to create shaders");if(T.shaderSource(t,e),T.shaderSource(o,n),T.compileShader(t),!T.getShaderParameter(t,T.COMPILE_STATUS))throw new Error("Vertex shader compilation failed: "+T.getShaderInfoLog(t));if(T.compileShader(o),!T.getShaderParameter(o,T.COMPILE_STATUS))throw new Error("Fragment shader compilation failed: "+T.getShaderInfoLog(o));const r=T.createProgram();if(!r)throw new Error("Failed to create shader program");if(T.attachShader(r,t),T.attachShader(r,o),T.linkProgram(r),!T.getProgramParameter(r,T.LINK_STATUS))throw new Error("Shader program linking failed: "+T.getProgramInfoLog(r));T.useProgram(r);const i=137,a=new Float32Array(4*i),s=2*Math.PI/i;for(let e=0;e<i;e++){const n=e*s;a[4*e]=0,a[4*e+1]=0,a[4*e+2]=Math.cos(n)*(C.width/2),a[4*e+3]=Math.sin(n)*(C.height/2)}const c=T.createBuffer();T.bindBuffer(T.ARRAY_BUFFER,c),T.bufferData(T.ARRAY_BUFFER,a,T.STATIC_DRAW);const l=T.getAttribLocation(r,"position");T.enableVertexAttribArray(l),T.vertexAttribPointer(l,2,T.FLOAT,!1,0,0),T.viewport(0,0,C.width,C.height),T.clearColor(0,0,0,1),T.clear(T.COLOR_BUFFER_BIT),T.drawArrays(T.LINES,0,2*i);const u=new Uint8ClampedArray(C.width*C.height*4);T.readPixels(0,0,C.width,C.height,T.RGBA,T.UNSIGNED_BYTE,u);return new ImageData(u,C.width,C.height)}catch(e){return new ImageData(1,1)}finally{T&&(T.bindBuffer(T.ARRAY_BUFFER,null),T.useProgram(null),T.viewport(0,0,T.drawingBufferWidth,T.drawingBufferHeight),T.clearColor(0,0,0,0))}}()));return{commonPixelsHash:d(a(e,C.width,C.height).data.toString()).toString()}}catch(e){return{webgl:"unsupported"}}}},O={},I={timeout:"true"},R=(e,n,t)=>{O[e]=n};function _(){return"1.2.0"}function L(e,n){var t;let o=M();if("unknown"===o.name&&e.system&&"object"==typeof e.system&&!Array.isArray(e.system)){const n=e.system.browser;if(n&&"object"==typeof n&&!Array.isArray(n)){const e=n;o={name:e.name||"unknown",version:e.version||"unknown"}}}const i=o.name.toLowerCase(),a=o.version.split(".")[0]||"0",s=parseInt(a,10),c=[...(null==n?void 0:n.exclude)||[]],l=(null==n?void 0:n.stabilize)||[],u=(null==n?void 0:n.include)||[];for(const e of l){const n=r[e];if(n)for(const e of n){const n=!("browsers"in e),o=!n&&(null===(t=e.browsers)||void 0===t?void 0:t.some((e=>{const n=e.match(/(.+?)(>=)(\d+)/);if(n){const[,e,,t]=n,o=parseInt(t,10);return i===e&&s>=o}return i===e})));(n||o)&&c.push(...e.exclude)}}return function e(n,t=""){const o={};for(const[r,i]of Object.entries(n)){const n=t?`${t}.${r}`:r;if("object"!=typeof i||Array.isArray(i)||null===i){const e=c.some((e=>n.startsWith(e))),t=u.some((e=>n.startsWith(e)));e&&!t||(o[r]=i)}else{const t=e(i,n);Object.keys(t).length>0&&(o[r]=t)}}return o}(e)}const B="thumbmark_visitor_id";let D=null,F=null;const N=(e,t)=>{if(e.cache_api_call&&F)return Promise.resolve(F);if(D)return D;const o=`${n}/thumbmark`,r=function(){try{return localStorage.getItem(B)}catch(e){return null}}(),i={components:t,options:e,clientHash:d(JSON.stringify(t)),version:"1.2.0"};r&&(i.visitorId=r);const a=fetch(o,{method:"POST",headers:{"x-api-key":e.api_key,Authorization:"custom-authorized","Content-Type":"application/json"},body:JSON.stringify(i)}).then((e=>{if(!e.ok)throw new Error(`HTTP error! status: ${e.status}`);return e.json()})).then((e=>(e.visitorId&&e.visitorId!==r&&function(e){try{localStorage.setItem(B,e)}catch(e){}}(e.visitorId),F=e,D=null,e))).catch((e=>(console.error("Error fetching pro data",e),D=null,null))),s=e.timeout||5e3,c=new Promise((e=>{setTimeout((()=>{e({info:{timed_out:!0},version:"1.2.0"})}),s)}));return D=Promise.race([a,c]),D};async function U(e){const o={...t,...e},r={...k,...O},{elapsed:i,resolvedComponents:a}=await j(r,o),s=o.api_key?N(o,a):null,c=s?await s:null,l=o.performance?{elapsed:i}:{},u=L((null==c?void 0:c.components)||{},o),m={...a,...u},h=(null==c?void 0:c.info)||{uniqueness:{score:"api only"}},f=d(JSON.stringify(m));(async function(e,t,o){var r;const i=`${n}/log`,a={thumbmark:e,components:t,version:"1.2.0",options:o,path:null===(r=null===window||void 0===window?void 0:window.location)||void 0===r?void 0:r.pathname};if(!sessionStorage.getItem("_tmjs_l")&&Math.random()<1e-4){sessionStorage.setItem("_tmjs_l","1");try{await fetch(i,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(a)})}catch(e){}}})(f,m,o).catch((()=>{}));return{...(null==c?void 0:c.visitorId)&&{visitorId:c.visitorId},thumbmark:f,components:m,info:h,version:"1.2.0",...l}}async function j(e,n){const o={...t,...n},r=Object.entries(e).filter((([e])=>{var n;return!(null===(n=null==o?void 0:o.exclude)||void 0===n?void 0:n.includes(e))})).filter((([e])=>{var n,t,r,i;return(null===(n=null==o?void 0:o.include)||void 0===n?void 0:n.some((e=>e.includes("."))))?null===(t=null==o?void 0:o.include)||void 0===t?void 0:t.some((n=>n.startsWith(e))):0===(null===(r=null==o?void 0:o.include)||void 0===r?void 0:r.length)||(null===(i=null==o?void 0:o.include)||void 0===i?void 0:i.includes(e))})),i=r.map((([e])=>e)),a=r.map((([e,t])=>t(n))),s=await function(e,n,t){return Promise.all(e.map((e=>{const o=performance.now();return Promise.race([e.then((e=>({value:e,elapsed:performance.now()-o}))),(r=n,i=t,new Promise((e=>{setTimeout((()=>e(i)),r)}))).then((e=>({value:e,elapsed:performance.now()-o})))]);var r,i})))}(a,(null==o?void 0:o.timeout)||5e3,I),c={},l={};s.forEach(((e,n)=>{var t;null!=e.value&&(l[i[n]]=e.value,c[i[n]]=null!==(t=e.elapsed)&&void 0!==t?t:0)}));const u=L(l,o);return{elapsed:c,resolvedComponents:u}}e.Thumbmark=class{constructor(e){this.options={...t,...e}}async get(e){return U({...this.options,...e})}getVersion(){return"1.2.0"}includeComponent(e,n){R(e,n)}},e.filterThumbmarkData=L,e.getFingerprint=async function(e){try{const n=await U(o);return e?{hash:n.thumbmark.toString(),data:n.components}:n.thumbmark.toString()}catch(e){throw e}},e.getFingerprintData=async function(){return(await U(o)).components},e.getFingerprintPerformance=async function(){try{const{elapsed:e,resolvedComponents:n}=await j(k,o);return{...n,elapsed:e}}catch(e){throw e}},e.getThumbmark=U,e.getVersion=_,e.includeComponent=R,e.setOption=function(e,n){o[e]=n},e.stabilizationExclusionRules=r}));
//# sourceMappingURL=thumbmark.umd.js.map

// TimeMe.js should be loaded and running to track time as soon as it is loaded.

/**
 * @typedef {Object} BurstOptions
 * @property {boolean} enable_cookieless_tracking
 * @property {boolean} beacon_enabled
 * @property {boolean} do_not_track
 * @property {boolean} enable_turbo_mode
 * @property {boolean} track_url_change
 * @property {string} pageUrl
 * @property {boolean} cookieless
 */

/**
 * @typedef {Object} BurstState
 * @property {Object} tracking
 * @property {boolean} tracking.isInitialHit
 * @property {number} tracking.lastUpdateTimestamp
 * @property {string} tracking.beacon_url
 * @property {BurstOptions} options
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
 */

// Ensure tracking object exists
burst.tracking = burst.tracking || {
  isInitialHit: true,
  lastUpdateTimestamp: 0,
  ajaxUrl: '',
};

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
// Import goals if applicable
if (burst.goals?.active?.some(goal => !goal.page_url || goal.page_url === '' || goal.page_url === burst.options.pageUrl)) {
  import(burst.goals.scriptUrl).then(goals => goals.default());
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
    if (c.indexOf(nameEQ) === 0) return Promise.resolve(c.substring(nameEQ.length));
  }
  return Promise.reject(false);
};
/**
 * Set a cookie
 * @param name
 * @param value
 */
const burst_set_cookie = (name, value) => {
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
  if (burst.cache.useCookies !== null) return burst.cache.useCookies;
  const result = navigator.cookieEnabled && !burst.options.cookieless;
  burst.cache.useCookies = result;
  return result;
};
/**
 * Enable or disable cookies
 * @returns {boolean}
 */
function burst_enable_cookies() {
  burst.options.cookieless = false;
  if (burst_use_cookies()) {
    burst_uid().then(uid => burst_set_cookie('burst_uid', uid));
  }
}
/**
 * Get or set the user identifier
 * @returns {Promise}
 */
const burst_uid = () => {
  if (burst.cache.uid !== null) return Promise.resolve(burst.cache.uid);
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
 * @returns {string}
 */
const burst_generate_uid = () => {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(''); // nosemgrep
};

const burst_fingerprint = () => {
  if (burst.cache.fingerprint !== null) return Promise.resolve(burst.cache.fingerprint);
  const tm = new ThumbmarkJS.Thumbmark({
    exclude: [],

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
  const botPattern = /bot|spider|crawl|slurp|mediapartners|applebot|bing|duckduckgo|yandex|baidu|facebook|twitter/i;
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
  const result = '1' === navigator.doNotTrack || 
                 'yes' === navigator.doNotTrack ||
                 '1' === navigator.msDoNotTrack || 
                 '1' === window.doNotTrack || 
                 1 === navigator.globalPrivacyControl;    
  burst.cache.isDoNotTrack = result;
  return result;
};
const burst_log_tracking_error = ({ status = 0, error = '', data = {} }) => {
  if ( !burst.options.debug || !burst.tracking.ajaxUrl ) {
    return;
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

const burst_beacon_request = (payload) => {
  const blob = new Blob([payload], { type: 'application/json' });
  if ( burst.options.debug ) {
    fetch( burst.tracking.beacon_url, {
      method: 'POST',
      body: blob,
      keepalive: true,
      headers: {
        'Content-Type': 'application/json'
      }
    })
        .then(response => {
          if (!response.ok) {
              burst_log_tracking_error({
                status: 0,
                error: 'sendBeacon failed',
                data: payload
              });
          }
        })
        .catch(error => {
          burst_log_tracking_error({
            status: 0,
            error: error?.message || 'sendBeacon failed',
            data: payload
          });
        });
  } else {
    navigator.sendBeacon(burst.tracking.beacon_url, blob);
  }
}

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
 * Update the tracked hit
 * Mostly used for updating time spent on a page
 * Also used for updating the UID (from fingerprint to a cookie)
 */
async function burst_update_hit(update_uid = false, force = false) {
  await pageIsRendered;
  if (burst_is_user_agent() || burst_is_do_not_track()) return;
  if (burst.tracking.isInitialHit) {
    burst_track_hit();
    return;
  }

  // If we don't force the update, we only update the hit if 300ms have passed since the last update
  if (!force && Date.now() - burst.tracking.lastUpdateTimestamp < 300) return;

  document.dispatchEvent(new CustomEvent('burst_before_update_hit', { detail: burst }));

  const [time, id] = await Promise.all([
    burst_get_time_on_page(),
    update_uid ? Promise.all([burst_uid(), burst_fingerprint()]) : (burst_use_cookies() ? burst_uid() : burst_fingerprint())
  ]);

  const data = {
    fingerprint: update_uid ? id[1] : (burst_use_cookies() ? false : id),
    uid: update_uid ? id[0] : (burst_use_cookies() ? id : false),
    url: location.href,
    time_on_page: time,
    completed_goals: burst.goals.completed
  };

  if (time > 0 || data.uid !== false) {
    await burst_api_request({ data: data });
    burst.tracking.lastUpdateTimestamp = Date.now();
  }
}
/**
 * Track a hit
 *
 */
async function burst_track_hit() {
  await pageIsRendered;
  if (!burst.tracking.isInitialHit) {
    burst_update_hit();
    return;
  }
  if (burst_is_user_agent() || burst_is_do_not_track()) return;

  burst.tracking.isInitialHit = false;
  if (Date.now() - burst.tracking.lastUpdateTimestamp < 300) return;

  document.dispatchEvent(new CustomEvent('burst_before_track_hit', { detail: burst }));

  const [time, id] = await Promise.all([
    burst_get_time_on_page(),
    burst_use_cookies() ? burst_uid() : burst_fingerprint()
  ]);

  const data = {
    uid: burst_use_cookies() ? id : false,
    fingerprint: burst_use_cookies() ? false : id,
    url: location.href,
    referrer_url: document.referrer,
    user_agent: navigator.userAgent || 'unknown',
    device_resolution: `${window.screen.width * window.devicePixelRatio}x${window.screen.height * window.devicePixelRatio}`,
    time_on_page: time,
    completed_goals: burst.goals.completed,
    page_id: document.body?.dataset?.burst_id || 0,
    page_type: document.body?.dataset?.burst_type || '',
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
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden' || document.visibilityState === 'unloaded') {
      burst_update_hit();
    }
  };

  const handleUrlChange = () => {
    if (!burst.options.track_url_change) return;
    burst.tracking.isInitialHit = true;
    burst_track_hit();
  };

  // Handle external link clicks for Elementor loading animations/lazy loading
  const handleExternalLinkClick = (e) => {
    const target = e.target.closest('a');
    if (!target) return;
    
    // Check if this element is part of a goal
    const isGoalElement = burst.goals?.active?.some(goal => {
      if (goal.type !== 'clicks') return false;
      return target.closest(goal.selector);
    });

    // Only update hit if it's not a goal element, as the goal will be tracked by the goal tracker
    if (!isGoalElement) {
      burst_update_hit(false, false);
    }
  };

  // Attach event handlers
  if (burst.options.enable_turbo_mode) {
    if (document.readyState !== 'loading') {
      burst_track_hit();
    } else {
      document.addEventListener('load', burst_track_hit);
    }
  } else {
    burst_track_hit();
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);
  document.addEventListener('pagehide', () => burst_update_hit());
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

document.addEventListener('wp_listen_for_consent_change', e => {
  const changed = e.detail;
  if (changed.statistics === 'allow') {
    burst_init_events();
  }
});

if (typeof wp_has_consent !== 'function') {
  burst_init_events();
} else if (wp_has_consent('statistics')) {
  burst_init_events();
}

window.burst_uid = burst_uid;
window.burst_use_cookies = burst_use_cookies;
window.burst_fingerprint = burst_fingerprint;
window.burst_update_hit = burst_update_hit;
