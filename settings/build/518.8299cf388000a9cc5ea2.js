"use strict";(self.webpackChunkburst_statistics=self.webpackChunkburst_statistics||[]).push([[518],{7333:(t,e,s)=>{s.d(e,{Z:()=>g});var a=s(9307),r=(s(9196),s(8197)),l=s(7429),i=s(1491),n=s(4046),c=s(9749),o=s(5736),u=s(5678),m=s(9546),d=s(8518);const g=t=>{let{filter:e,filterValue:s,label:g,children:b,startDate:p,endDate:E}=t;if(!e||!s)return(0,a.createElement)(a.Fragment,null,b);const _=(0,r.y)((t=>t.setFilters)),h=(0,r.y)((t=>t.setAnimate)),v=(0,l.q)((t=>t.goalFields)),f=(0,i.B)((t=>t.setMetrics)),y=(0,i.B)((t=>t.metrics)),N=(0,n.Y)((t=>t.setStartDate)),k=(0,n.Y)((t=>t.setEndDate)),w=(0,n.Y)((t=>t.setRange)),Z=g?(0,o.__)("Click to filter by:","burst-statistics")+" "+g:(0,o.__)("Click to filter","burst-statistics");return(0,a.createElement)(c.Z,{title:Z},(0,a.createElement)("span",{onClick:async t=>{let a;if(window.location.href="#statistics","goal_id"===e?(v[s]&&v[s].goal_specific_page&&v[s].goal_specific_page.value?(_("page_url",v[s].goal_specific_page.value),_(e,s),u.toast.info((0,o.__)("Filtering by goal & goal specific page","burst-statistics"))):(_(e,s),u.toast.info((0,o.__)("Filtering by goal","burst-statistics"))),y.includes("conversions")||f([...y,"conversions"])):(_(e,""),await new Promise((t=>setTimeout(t,10))),_(e,s,!0),await(async t=>{const e=document.querySelector(".burst-data-filter--animate"),s=window.getComputedStyle(e),a=e.offsetParent?e.offsetParent.offsetLeft:0,r=e.offsetParent?e.offsetParent.offsetTop:0,l=parseInt(s.marginLeft),i=parseInt(s.marginTop),n=e.offsetWidth,c=e.offsetHeight,o=t.clientX-n+window.scrollX-a-l,u=t.clientY-4*c+window.scrollY-r-i;e.style.transformOrigin="50% 50%",e.style.opacity=0,e.style.transform=`translateX(${o}px) translateY(${u}px)`,await new Promise((t=>setTimeout(t,50))),e.style.transition="transform 0.2s ease, opacity 0.2s ease-out",e.style.transform=`translateX(${o}px) translateY(${u}px) scale(1)`,e.style.opacity=1,e.style.transition="transform 0.5s ease-in-out, opacity 0.2s ease-out",e.style.transform="translateX(0) translateY(0)"})(t),h(!1)),p&&("number"==typeof p||Date.parse(p)>=16409952e5)&&(a="number"==typeof p?(0,d.J7)(p):p),a){const t=E?E>0?(0,d.J7)(E):E:(0,m.default)(new Date,"yyyy-MM-dd");N(a),k(t),w("custom")}},className:"burst-click-to-filter"},b))}},492:(t,e,s)=>{s.d(e,{Z:()=>l});var a=s(9307),r=s(5736);s(9196);const l=t=>{let e=t.notice;return(0,a.createElement)("div",{className:"burst-task-element"},(0,a.createElement)("span",{className:"burst-task-status burst-"+e.output.icon},e.output.label),(0,a.createElement)("p",{className:"burst-task-message",dangerouslySetInnerHTML:{__html:e.output.msg}}),e.output.url&&(0,a.createElement)("a",{target:"_blank",href:e.output.url},(0,r.__)("More info","burst-statistics")),e.output.highlight_field_id&&(0,a.createElement)("span",{className:"burst-task-enable",onClick:()=>{t.highLightField(t.notice.output.highlight_field_id)}},(0,r.__)("Fix","burst-statistics")),e.output.plusone&&(0,a.createElement)("span",{className:"burst-plusone"},"1"),e.output.dismissible&&"completed"!==e.output.status&&(0,a.createElement)("div",{className:"burst-task-dismiss"},(0,a.createElement)("button",{type:"button","data-id":e.id,onClick:t.onCloseTaskHandler},(0,a.createElement)("span",{className:"burst-close-warning-x"},(0,a.createElement)("svg",{width:"20",height:"20",viewBox:"0, 0, 400,400"},(0,a.createElement)("path",{id:"path0",d:"M55.692 37.024 C 43.555 40.991,36.316 50.669,36.344 62.891 C 36.369 73.778,33.418 70.354,101.822 138.867 L 162.858 200.000 101.822 261.133 C 33.434 329.630,36.445 326.135,36.370 337.109 C 36.270 351.953,47.790 363.672,62.483 363.672 C 73.957 363.672,68.975 367.937,138.084 298.940 L 199.995 237.127 261.912 298.936 C 331.022 367.926,326.053 363.672,337.517 363.672 C 351.804 363.672,363.610 352.027,363.655 337.891 C 363.689 326.943,367.629 331.524,299.116 262.841 C 265.227 228.868,237.500 200.586,237.500 199.991 C 237.500 199.395,265.228 171.117,299.117 137.150 C 367.625 68.484,363.672 73.081,363.672 62.092 C 363.672 48.021,351.832 36.371,337.500 36.341 C 326.067 36.316,331.025 32.070,261.909 101.066 L 199.990 162.877 138.472 101.388 C 87.108 50.048,76.310 39.616,73.059 38.191 C 68.251 36.083,60.222 35.543,55.692 37.024 ",stroke:"none",fill:"#000000"}))))))}},5428:(t,e,s)=>{s.d(e,{Z:()=>r});var a=s(9307);const r=t=>{const{className:e,title:s,controls:r,children:l,footer:i}=t;return(0,a.createElement)("div",{className:"burst-grid-item "+e},(0,a.createElement)("div",{className:"burst-grid-item-header"},(0,a.createElement)("h3",{className:"burst-grid-title burst-h4"},s),(0,a.createElement)("div",{className:"burst-grid-item-controls"},r)),(0,a.createElement)("div",{className:"burst-grid-item-content"},l),(0,a.createElement)("div",{className:"burst-grid-item-footer"},i))}},1518:(t,e,s)=>{s.r(e),s.d(e,{default:()=>T});var a=s(9307),r=s(9196),l=s(492),i=s(5736),n=s(270),c=s(8399);const o=(0,n.Ue)(((t,e)=>({filter:"all",notices:[],filteredNotices:[],error:!1,loading:!0,setFilter:e=>{sessionStorage.burst_task_filter=e,t((t=>({filter:e})))},fetchFilter:()=>{if("undefined"!=typeof Storage&&sessionStorage.burst_task_filter){let e=sessionStorage.burst_task_filter;t((t=>({filter:e})))}},filterNotices:()=>{let s=[];e().notices.map(((t,e)=>{"warning"!==t.output.icon&&"error"!==t.output.icon&&"open"!==t.output.icon||s.push(t)})),t((t=>({filteredNotices:s})))},getNotices:async()=>{try{const{notices:s}=await c.Kw("notices");t((t=>({notices:s,loading:!1}))),e().filterNotices()}catch(e){t((t=>({error:e.message})))}},dismissNotice:async s=>{let a=e().notices;a=a.filter((function(t){return t.id!==s})),t((t=>({notices:a}))),await c.Kw("dismiss_task",{id:s}).then((t=>{t.error&&console.error(t.error)}))}})));var u=s(5428);const m=t=>{let{countAll:e,countRemaining:s}=t;const{setFilter:r,filter:l,notices:n,filteredNotices:c}=o((t=>({setFilter:t.setFilter,filter:t.filter}))),u=t=>{let e=t.target.getAttribute("data-filter");"all"!==e&&"remaining"!==e||r(e)};return(0,a.createElement)("div",{className:`burst-task-switcher-container burst-active-filter-${l}`},(0,a.createElement)("span",{className:"burst-task-switcher burst-all-tasks",onClick:u,"data-filter":"all"},(0,i.__)("All tasks","burst-statistics"),(0,a.createElement)("span",{className:"burst_task_count"},"(",e,")")),(0,a.createElement)("span",{className:"burst-task-switcher burst-remaining-tasks",onClick:u,"data-filter":"remaining"},(0,i.__)("Remaining tasks","burst-statistics"),(0,a.createElement)("span",{className:"burst_task_count"},"(",s,")")))};var d=s(3882),g=(s(5609),s(9749)),b=s(8518);const p=t=>{let[e,s]=(0,r.useState)("loading"),[l,n]=(0,r.useState)(0);(0,r.useMemo)((()=>{c.Kw("tracking").then((t=>{if("beacon"===t.status||"rest"===t.status||"disabled"===t.status){let e=t.status?t.status:"error",a=t.last_test?t.last_test:(0,i.__)("Just now","burst-statistics");s(e),n(a)}else s("error"),n(!1)}))}),[]);let o=(0,i.__)("Last checked:","burst-statistics")+" "+(0,b.ni)(new Date(1e3*l)),u={loading:(0,i.__)("Loading tracking status...","burst-statistics"),error:(0,i.__)("Error checking tracking status","burst-statistics"),rest:(0,i.__)("Tracking with REST API","burst-statistics"),beacon:(0,i.__)("Tracking with an endpoint","burst-statistics"),disabled:(0,i.__)("Tracking is disabled","burst-statistics")},m={loading:{icon:"loading",color:"black"},error:{icon:"circle-times",color:"red"},rest:{icon:"circle-check",color:"green"},beacon:{icon:"circle-check",color:"green"},disabled:{icon:"circle-times",color:"red"}},p={loading:"",error:(0,i.__)("Tracking does not seem to work. Check manually or contact support.","burst-statistics"),rest:(0,i.__)("Tracking is working. You are using the REST API to collect statistics.","burst-statistics"),beacon:(0,i.__)("Tracking is working. You are using the Burst endpoint to collect statistics. This type of tracking is accurate and lightweight.","burst-statistics"),disabled:(0,i.__)("Tracking is disabled","burst-statistics")}[e]+" "+o,E=u[e],_=m[e].icon,h=m[e].color;return(0,a.createElement)(a.Fragment,null,(0,a.createElement)("a",{className:"burst-button burst-button--secondary",href:"#statistics"},(0,i.__)("View my statistics","burst-statistics")),(0,a.createElement)(g.Z,{arrow:!0,title:p,enterDelay:200},(0,a.createElement)("div",{className:"burst-legend burst-flex-push-right"},(0,a.createElement)(d.Z,{name:_,color:h}),(0,a.createElement)("div",null,E))))},E=()=>(0,a.createElement)("div",{className:"burst-task-element"},(0,a.createElement)("span",{className:"burst-task-status burst-loading"},(0,i.__)("Loading...","burst-statistics")),(0,a.createElement)("p",{className:"burst-task-message"},(0,i.__)("Loading notices...","burst-statistics"))),_=()=>(0,a.createElement)("div",{className:"burst-task-element"},(0,a.createElement)("span",{className:"burst-task-status burst-completed"},(0,i.__)("Completed","burst-statistics")),(0,a.createElement)("p",{className:"burst-task-message"},(0,i.__)("No remaining tasks to show","burst-statistics"))),h=t=>{let{highLightField:e}=t;const s=o((t=>t.loading)),n=o((t=>t.filter)),c=o((t=>t.notices)),d=o((t=>t.getNotices)),g=o((t=>t.filteredNotices)),b=o((t=>t.dismissNotice));(0,r.useEffect)((()=>{d()}),[d]);const h="remaining"===n?g:c;return(0,a.createElement)(u.Z,{className:"burst-column-2 burst-progress",title:(0,i.__)("Progress","burst-statistics"),controls:(0,a.createElement)(m,{countAll:c.length,countRemaining:g.length}),footer:(0,a.createElement)(p,null)},(0,a.createElement)("div",{className:"burst-progress-block"},(0,a.createElement)("div",{className:"burst-scroll-container"},s?(0,a.createElement)(E,null):0===h.length?(0,a.createElement)(_,null):h.map((t=>(0,a.createElement)(l.Z,{key:t.id,notice:t,onCloseTaskHandler:()=>b(t.id),highLightField:e}))))))};var v=s(3591);const f=()=>{const t=(0,v.x)((t=>t.live)),e=(0,v.x)((t=>t.incrementUpdateLive)),s=(0,v.x)((t=>t.data)),r=(0,v.x)((t=>t.incrementUpdateData));function l(t){return(t=parseInt(t))>100?"visitors-crowd":t>10?"visitors":"visitor"}(0,a.useEffect)((()=>{let t,s;const a=()=>{document.hidden?(clearInterval(t),clearInterval(s)):(t=setInterval((()=>{e()}),5e3),s=setInterval((()=>{r()}),1e4))};return document.addEventListener("visibilitychange",a),a(),()=>{clearInterval(t),clearInterval(s),document.removeEventListener("visibilitychange",a)}}),[]);let n=l(t),c=l(s.today.value);const o=200;return(0,a.createElement)(u.Z,{className:"border-to-border burst-today",title:(0,i.__)("Today","burst-statistics")},(0,a.createElement)("div",{className:"burst-today"},(0,a.createElement)("div",{className:"burst-today-select"},(0,a.createElement)(g.Z,{arrow:!0,title:s.live.tooltip,enterDelay:o},(0,a.createElement)("div",{className:"burst-today-select-item"},(0,a.createElement)(d.Z,{name:n,size:"23"}),(0,a.createElement)("h2",null,t),(0,a.createElement)("span",null,(0,a.createElement)(d.Z,{name:"live",size:"12",color:"red"})," ",(0,i.__)("Live","burst-statistics")))),(0,a.createElement)(g.Z,{arrow:!0,title:s.today.tooltip,enterDelay:o},(0,a.createElement)("div",{className:"burst-today-select-item"},(0,a.createElement)(d.Z,{name:c,size:"23"}),(0,a.createElement)("h2",null,s.today.value),(0,a.createElement)("span",null,(0,a.createElement)(d.Z,{name:"total",size:"13",color:"green"})," ",(0,i.__)("Total","burst-statistics"))))),(0,a.createElement)("div",{className:"burst-today-list"},(0,a.createElement)(g.Z,{arrow:!0,title:s.mostViewed.tooltip,enterDelay:o},(0,a.createElement)("div",{className:"burst-today-list-item"},(0,a.createElement)(d.Z,{name:"winner"}),(0,a.createElement)("p",{className:"burst-today-list-item-text"},decodeURI(s.mostViewed.title)),(0,a.createElement)("p",{className:"burst-today-list-item-number"},s.mostViewed.value))),(0,a.createElement)(g.Z,{arrow:!0,title:s.referrer.tooltip,enterDelay:o},(0,a.createElement)("div",{className:"burst-today-list-item"},(0,a.createElement)(d.Z,{name:"referrer"}),(0,a.createElement)("p",{className:"burst-today-list-item-text"},decodeURI(s.referrer.title)),(0,a.createElement)("p",{className:"burst-today-list-item-number"},s.referrer.value))),(0,a.createElement)(g.Z,{arrow:!0,title:s.pageviews.tooltip,enterDelay:o},(0,a.createElement)("div",{className:"burst-today-list-item"},(0,a.createElement)(d.Z,{name:"pageviews"}),(0,a.createElement)("p",{className:"burst-today-list-item-text"},s.pageviews.title),(0,a.createElement)("p",{className:"burst-today-list-item-number"},s.pageviews.value))),(0,a.createElement)(g.Z,{arrow:!0,title:s.timeOnPage.tooltip,enterDelay:o},(0,a.createElement)("div",{className:"burst-today-list-item"},(0,a.createElement)(d.Z,{name:"time"}),(0,a.createElement)("p",{className:"burst-today-list-item-text"},s.timeOnPage.title),(0,a.createElement)("p",{className:"burst-today-list-item-number"},s.timeOnPage.value))))))};var y=s(7333),N=s(9546);const k=t=>{let{data:e}=t;const{dateStart:s,dateEnd:r,dateCreated:l,status:n}=e,c=(t=>{switch(t){case"active":return"green";case"inactive":return"grey";default:return"gray"}})(n),o=s||l,u=(s?(0,i.__)("Started","burst-statistics"):(0,i.__)("Created","burst-statistics"),(0,b.ni)(o),(t=>{switch(t){case"active":return(0,i.__)("Active","burst-statistics");case"inactive":return(0,i.__)("Inactive","burst-statistics");default:return(0,i.__)("Unknown","burst-statistics")}})(n));return(0,a.createElement)("div",{className:"burst-goal-status"},(0,a.createElement)(d.Z,{name:"dot",color:c,size:12}),(0,a.createElement)("p",null,u))};var w=s(1537),Z=s(7702);const D=t=>{let{goalId:e,goals:s}=t;const r=(0,w.h)((t=>t.setGoalId));if(!1===e)return null;if(!Object.keys(s).length>0)return(0,a.createElement)(d.Z,{name:"loading"});const l=Object.keys(s)[0];return(0,a.createElement)("div",{className:"burst-goals-controls-flex"},1===Object.keys(s).length&&s[l]&&(0,a.createElement)("p",null,s[l].title),Object.keys(s).length>1&&(0,a.createElement)("select",{onChange:t=>{r(t.target.value)}},Object.entries(s).map((t=>{let[e,s]=t;return(0,a.createElement)("option",{key:e,value:e},s.title)}))))},C=()=>{const t=(0,w.h)((t=>t.live)),e=(0,w.h)((t=>t.incrementUpdateLive)),s=(0,w.h)((t=>t.data)),l=((0,w.h)((t=>t.loading)),(0,w.h)((t=>t.setLoading))),n=(0,w.h)((t=>t.incrementUpdateData)),o=(0,w.h)((t=>t.goalId)),m=(0,w.h)((t=>t.setGoalId)),b=(0,Z.W)((t=>t.goals)),[p,E]=(0,r.useState)(!1);function _(t){return(t=parseInt(t))>10||t>0?"goals":"goals-empty"}(0,r.useEffect)((()=>{if(!1===o){const t=Object.keys(b)[0];t&&m(t)}0===Object.keys(b).length?(E(!0),l(!1)):E(!1)}),[o,b]),(0,r.useEffect)((()=>{if(!p){let t,s;const a=()=>{document.hidden?(clearInterval(t),clearInterval(s)):(t=setInterval((()=>{e()}),5e3),s=setInterval((()=>{n()}),1e4))};return document.addEventListener("visibilitychange",a),a(),()=>{clearInterval(t),clearInterval(s),document.removeEventListener("visibilitychange",a)}}}),[p]);let h=_(t),v=_(s.total.value);const f=200;let C=!1,I=!1;s.dateStart>0&&(C=s.dateStart,s.dateEnd>0&&(I=s.dateEnd));let A=(0,N.default)(new Date,"yyyy-MM-dd");return(0,a.createElement)(u.Z,{className:"border-to-border burst-goals",title:(0,i.__)("Goals","burst-statistics"),controls:(0,a.createElement)(D,{goalId:o,goals:b}),footer:!p&&(0,a.createElement)(a.Fragment,null,(0,a.createElement)("a",{className:"burst-button burst-button--secondary",href:"#settings/goals"},(0,i.__)("View setup","burst-statistics")),(0,a.createElement)("div",{className:"burst-flex-push-right"},(0,a.createElement)(k,{data:s})))},(0,a.createElement)("div",{className:"burst-goals burst-loading-container"},"1"!==burst_settings.goals_information_shown&&(0,a.createElement)("div",{className:"information-overlay"},(0,a.createElement)("div",{className:"information-overlay-container"},(0,a.createElement)("h4",null,(0,i.__)("Goals","burst-statistics")),(0,a.createElement)("p",null,(0,i.__)("The all new goals! Keep track of customizable goals and get valuable insights. Add your first goal!","burst-statistics")),(0,a.createElement)("p",null,(0,a.createElement)("a",{href:"https://burst-statistics.com/how-to-set-goals/"},(0,i.__)("Learn how to set your first goal","burst-statistics"))),(0,a.createElement)("a",{onClick:()=>{burst_settings.goals_information_shown="1",(0,c.l)("goals_information_shown",!0),window.location.hash="#settings/goals"},className:"burst-button burst-button--primary"},(0,i.__)("Create my first goal","burst-statistics")))),(0,a.createElement)("div",{className:"burst-goals-select"},(0,a.createElement)(y.Z,{filter:"goal_id",filterValue:s.goalId,label:s.today.tooltip+(0,i.__)("Goal and today","burst-statistics"),startDate:A},(0,a.createElement)("div",{className:"burst-goals-select-item"},(0,a.createElement)(d.Z,{name:h,size:"23"}),(0,a.createElement)("h2",null,t),(0,a.createElement)("span",null,(0,a.createElement)(d.Z,{name:"sun",color:"yellow",size:"13"})," ",(0,i.__)("Today","burst-statistics")))),(0,a.createElement)(y.Z,{filter:"goal_id",filterValue:s.goalId,label:s.today.tooltip+(0,i.__)("Goal and the start date","burst-statistics"),startDate:C,endDate:I},(0,a.createElement)("div",{className:"burst-goals-select-item"},(0,a.createElement)(d.Z,{name:v,size:"23"}),(0,a.createElement)("h2",null,s.total.value),(0,a.createElement)("span",null,(0,a.createElement)(d.Z,{name:"total",size:"13",color:"green"})," ",(0,i.__)("Total","burst-statistics"))))),(0,a.createElement)("div",{className:"burst-goals-list"},(0,a.createElement)(g.Z,{arrow:!0,title:decodeURI(s.topPerformer.tooltip),enterDelay:f},(0,a.createElement)("div",{className:"burst-goals-list-item"},(0,a.createElement)(d.Z,{name:"winner"}),(0,a.createElement)("p",{className:"burst-goals-list-item-text"},s.topPerformer.title),(0,a.createElement)("p",{className:"burst-goals-list-item-number"},s.topPerformer.value))),(0,a.createElement)(g.Z,{arrow:!0,title:s.pageviews.tooltip,enterDelay:f},(0,a.createElement)("div",{className:"burst-goals-list-item"},(0,a.createElement)(d.Z,{name:"pageviews"}),(0,a.createElement)("p",{className:"burst-goals-list-item-text"},s.pageviews.title),(0,a.createElement)("p",{className:"burst-goals-list-item-number"},s.pageviews.value))),(0,a.createElement)(g.Z,{arrow:!0,title:s.conversionPercentage.tooltip,enterDelay:f},(0,a.createElement)("div",{className:"burst-goals-list-item"},(0,a.createElement)(d.Z,{name:"graph"}),(0,a.createElement)("p",{className:"burst-goals-list-item-text"},s.conversionPercentage.title),(0,a.createElement)("p",{className:"burst-goals-list-item-number"},s.conversionPercentage.value))),(0,a.createElement)(g.Z,{arrow:!0,title:s.bestDevice.tooltip,enterDelay:f},(0,a.createElement)("div",{className:"burst-goals-list-item"},(0,a.createElement)(d.Z,{name:s.bestDevice.icon}),(0,a.createElement)("p",{className:"burst-goals-list-item-text"},s.bestDevice.title),(0,a.createElement)("p",{className:"burst-goals-list-item-number"},s.bestDevice.value))))))},I=t=>(0,a.createElement)(u.Z,{className:"burst-column-2",title:(0,i.__)("Tips & Tricks","burst-statistics"),footer:(0,a.createElement)("a",{href:"https://burst-statistics.com/docs/",target:"_blank",className:"burst-button burst-button--secondary"},(0,i.__)("View all","burst-statistics"))},(0,a.createElement)("div",{className:"burst-tips-tricks-container"},[{content:"Hidden Features of the Insights Graph",link:"https://burst-statistics.com/hidden-features-of-the-insights-graph/"},{content:"What is Cookieless tracking?",link:"https://burst-statistics.com/what-is-cookieless-tracking/"},{content:"Why is Burst Privacy-Friendly?",link:"https://burst-statistics.com/why-is-burst-privacy-friendly/"},{content:"How can I compare metrics?",link:"https://burst-statistics.com/how-can-i-compare-metrics/"},{content:"What is Bounce Rate?",link:"https://burst-statistics.com/definition/what-is-bounce-rate/"},{content:"How to set goals?",link:"https://burst-statistics.com/how-to-set-goals/"}].map(((t,e)=>(0,a.createElement)("div",{key:e,className:"burst-tips-tricks-element"},(0,a.createElement)("a",{href:t.link,target:"_blank",rel:"noopener noreferrer",title:t.content},(0,a.createElement)("div",{className:"burst-bullet medium"}),(0,a.createElement)("div",{className:"burst-tips-tricks-content"},t.content))))))),A=(0,n.Ue)((t=>({dataLoaded:!1,setDataLoaded:e=>{t((t=>({dataLoaded:e})))},pluginData:!1,setPluginData:e=>{t((t=>({pluginData:e})))}}))),L=()=>{const[t,e]=(0,r.useState)(""),s=A((t=>t.dataLoaded)),l=A((t=>t.setDataLoaded)),n=A((t=>t.pluginData)),o=A((t=>t.setPluginData));(0,r.useEffect)((()=>{s||c.Kw("otherpluginsdata").then((t=>{t.forEach((function(e,s){t[s].pluginActionNice=b(e.pluginAction)})),o(t),l(!0)}))}),[]);const m=(t,e,s)=>{s&&s.preventDefault();let a={};a.slug=t,a.pluginAction=e;let r=d(t);"download"===e?r.pluginAction="downloading":"activate"===e&&(r.pluginAction="activating"),r.pluginActionNice=b(r.pluginAction),g(t,r),"installed"!==e&&"upgrade-to-pro"!==e&&c.Kw("plugin_actions",a).then((e=>{r=e,g(t,r),m(t,r.pluginAction)}))},d=t=>n.filter((e=>e.slug===t))[0],g=(t,s)=>{n.forEach((function(e,a){e.slug===t&&(n[a]=s)})),o(n),e(t+s.pluginAction)},b=t=>({download:(0,i.__)("Install","burst-statistics"),activate:(0,i.__)("Activate","burst-statistics"),activating:(0,i.__)("Activating...","burst-statistics"),downloading:(0,i.__)("Downloading...","burst-statistics"),"upgrade-to-pro":(0,i.__)("Downloading...","burst-statistics")}[t]);if(!s){const t=3;return(0,a.createElement)(u.Z,{className:"burst-column-2 no-border no-background",title:(0,i.__)("Other plugins","burst-statistics")},(0,a.createElement)("div",{className:"burst-other-plugins-container"},[...Array(t)].map(((t,e)=>(0,a.createElement)("div",{key:e,className:"burst-other-plugins-element"},(0,a.createElement)("a",null,(0,a.createElement)("div",{className:"burst-bullet"}),(0,a.createElement)("div",{className:"burst-other-plugins-content"},(0,i.__)("Loading..","burst-statistics"))),(0,a.createElement)("div",{className:"burst-other-plugin-status"},(0,i.__)("Activate","burst-statistics")))))))}return(0,a.createElement)(u.Z,{className:"burst-column-2 no-border no-background",title:(0,i.__)("Other plugins","burst-statistics")},(0,a.createElement)("div",{className:"burst-other-plugins-container"},n.map(((t,e)=>((t,e)=>(0,a.createElement)("div",{key:e,className:"burst-other-plugins-element burst-"+t.slug},(0,a.createElement)("a",{href:t.wordpress_url,target:"_blank",title:t.title},(0,a.createElement)("div",{className:"burst-bullet"}),(0,a.createElement)("div",{className:"burst-other-plugins-content"},t.title)),(0,a.createElement)("div",{className:"burst-other-plugin-status"},"upgrade-to-pro"===t.pluginAction&&(0,a.createElement)(a.Fragment,null,(0,a.createElement)("a",{target:"_blank",href:t.upgrade_url},(0,i.__)("Upgrade","burst-statistics"))),"upgrade-to-pro"!==t.pluginAction&&"installed"!==t.pluginAction&&(0,a.createElement)(a.Fragment,null,(0,a.createElement)("a",{href:"settings/src/components/pages/Dashboard/OtherPlugins#",onClick:e=>m(t.slug,t.pluginAction,e)},t.pluginActionNice)),"installed"===t.pluginAction&&(0,a.createElement)(a.Fragment,null,(0,i.__)("Installed","burst-statistics")))))(t,e)))))},T=()=>(0,a.createElement)("div",{className:"burst-content-area burst-grid burst-dashboard"},(0,a.createElement)(h,null),(0,a.createElement)(f,null),(0,a.createElement)(C,null),(0,a.createElement)(I,null),(0,a.createElement)(L,null))}}]);