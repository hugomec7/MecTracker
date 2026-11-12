class VideoClipTrackItem{constructor(o){Object.assign(this,o)}}
const T=254016000000;
function TT(t){return {ticksNumber:Number(t)}}
function clip(name,track,s,e){return new VideoClipTrackItem({_n:name,_t:track,_s:s*T,_e:e*T,getName:async function(){return this._n},getStartTime:async function(){return TT(this._s)},getEndTime:async function(){return TT(this._e)},getInPoint:async()=>TT(0),getProjectItem:async()=>{throw 1},getTrackIndex:async function(){return this._t}})}
window.CLIPS=[[clip('Filmagem.mp4',0,0,10)],[clip('Titulo',1,2,6),clip('Logo',1,7,9)]];
window.SELECTED=[window.CLIPS[0][0]];
var seq={name:'Seq 01',guid:'g1',getSelection:async()=>({getTrackItems:async()=>window.SELECTED.slice()}),getPlayerPosition:async()=>TT(3*T),getVideoTrackCount:async()=>window.CLIPS.length,getVideoTrack:async i=>({getTrackItems:async()=>window.CLIPS[i].slice()})};
var ppro={VideoClipTrackItem,Project:{getActiveProject:async()=>({getActiveSequence:async()=>seq})},TickTime:{createWithTicks:x=>TT(x)},Constants:{TrackItemType:{CLIP:1}}};
var uxp={storage:{localFileSystem:{getDataFolder:async()=>{throw 1}}},versions:{plugin:'3.4.0'},shell:{}};
window.require=function(n){return n==='premierepro'?ppro:n==='uxp'?uxp:{}};
window.__MT_TEST__={};
localStorage.setItem('mectracker.lang','pt');
window.fetch=async()=>{throw 1};
