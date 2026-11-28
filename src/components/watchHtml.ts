// Birlikte izle oynatıcısı (YouTube iframe API). Telefonda WebView, web önizlemesinde iframe içinde çalışır.
export const watchHtml = (videoId: string) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#p{width:100%;height:100%}</style></head><body><div id="p"></div>
<script>
var player,ignore=0,ready=false,queued=null;
function post(m){var s=JSON.stringify(m);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(s);else parent.postMessage({kankaWatch:s},'*');}
function onYouTubeIframeAPIReady(){player=new YT.Player('p',{videoId:${JSON.stringify(videoId)},playerVars:{playsinline:1,autoplay:1,rel:0,modestbranding:1},events:{
onReady:function(){ready=true;post({t:'ready'});if(queued){apply(queued[0],queued[1]);queued=null;}},
onStateChange:function(e){if(Date.now()<ignore)return;if(e.data==1)post({t:'ctl',playing:true,time:player.getCurrentTime()});else if(e.data==2)post({t:'ctl',playing:false,time:player.getCurrentTime()});},
onError:function(e){post({t:'err',code:e.data});}}});}
function apply(playing,time){if(!ready){queued=[playing,time];return;}ignore=Date.now()+1500;if(Math.abs(player.getCurrentTime()-time)>2)player.seekTo(time,true);if(playing)player.playVideo();else player.pauseVideo();}
window.addEventListener('message',function(e){if(e.data&&e.data.kankaApply)apply(e.data.kankaApply[0],e.data.kankaApply[1]);});
</script><script src="https://www.youtube.com/iframe_api"></script></body></html>`;
// Şu an videonun kaçıncı saniyesinde olunmalı
export const watchPos = (st: { playing: boolean; time: number; at: number }) => st.time + (st.playing ? Math.max(0, Date.now() - st.at) / 1000 : 0);
