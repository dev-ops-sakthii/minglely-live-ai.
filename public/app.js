const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let mode = "video", ws, localStream, pc, room, initiator = false;
let muted = false, camOff = false, reconnectDelay = 1000, reconnectTimer = null;

const languages = ["Tamil","Malayalam","Telugu","Kannada","Hindi","English"];
let language = "Tamil", aiMode = false, aiTimer = null, fallbackTimer = null;
const languageBox = $("#languages");
languages.forEach(x=>{const b=document.createElement("button");b.className="language"+(x===language?" active":"");b.textContent=x;b.onclick=()=>{$$(".language").forEach(y=>y.classList.remove("active"));b.classList.add("active");language=x};languageBox.appendChild(b)});

$$(".mode").forEach(b=>b.onclick=()=>{$$(".mode").forEach(x=>x.classList.remove("active"));b.classList.add("active");mode=b.dataset.mode});

function toast(message){const el=$("#toast");if(!el)return;el.textContent=message;el.classList.add("show");clearTimeout(el._timer);el._timer=setTimeout(()=>el.classList.remove("show"),2800)}
function connect(){
  const proto=location.protocol==="https:"?"wss":"ws";
  const socket=new WebSocket(`${proto}://${location.host}`);
  ws=socket;
  socket.onopen=()=>{
    reconnectDelay=1000;
    if(!$("#chat").classList.contains("hidden")){
      closePeer(); clearMessages(); addSystem("Connection restored. Finding a new conversation…"); queue();
    }
  };
  socket.onmessage=e=>{try{handle(JSON.parse(e.data))}catch{}};
  socket.onclose=()=>{
    toast("Connection lost. Reconnecting…");
    if(!reconnectTimer){reconnectTimer=setTimeout(()=>{reconnectTimer=null;connect()},reconnectDelay);reconnectDelay=Math.min(reconnectDelay*2,30000)}
  };
}
connect();

$("#startBtn").onclick=start;
async function start(){
  if(!$("#ageConfirm").checked){toast("Please confirm that you are 18 or older.");return}
  $("#home").classList.add("hidden");$("#chat").classList.remove("hidden");
  clearMessages(); addSystem("Looking for someone who is online…");
  if(mode==="video"){
    try{
      localStream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
      $("#localVideo").srcObject=localStream;
    }catch(err){toast("Camera/microphone permission is needed for video. Switching to text.");mode="text"}
  }
  if(ws?.readyState===WebSocket.OPEN) queue();
}
function queue(){
  aiMode=false; clearTimeout(aiTimer); clearTimeout(fallbackTimer);
  send({type:"queue",mode,country:$("#country").value,language});
  fallbackTimer=setInterval(()=>{ if(!aiMode && $("#matchInfo").textContent.includes("Searching")) { const left=60-Math.floor((Date.now()-window.queueStarted)/1000); if(left<=0){clearInterval(fallbackTimer); addSystem("No same-language stranger yet. Expanding to all languages…");} }},1000);
  window.queueStarted=Date.now();
}
function send(o){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(o))}
function handle(m){
  if(m.type==="searching"){ $("#matchInfo").textContent=`Searching in ${m.language || language}…`;$(".waiting").style.display="flex"; }
  if(m.type==="matched"){
    clearInterval(fallbackTimer); room=m.room;initiator=m.initiator;
    $("#matchInfo").textContent=`Language: ${m.language || language}${m.fallback ? " • expanded match" : ""}`;
    $(".waiting").style.display="none";$("#matchDot").style.background="#22c55e";
    addSystem("You are connected. Say hello!");
    if(mode==="video")setupPeer();
  }
  if(m.type==="chat"){addBubble(m.text,false);setTyping(false)}
  if(m.type==="typing")setTyping(m.active)
  if(m.type==="signal")onSignal(m.data)
  if(m.type==="partner_left"){closePeer();addSystem("The stranger left.");$("#matchDot").style.background="#64748b"; if(mode==="video") setTimeout(startAI,1200)}
  if(m.type==="reported")toast("Report received for this session.");
}
async function startAI(){
  if(aiMode) return; aiMode=true; clearInterval(fallbackTimer); closePeer();
  $(".waiting").style.display="none"; $("#aiAvatar").classList.remove("hidden"); $("#aiNotice").classList.remove("hidden"); $("#partnerName").firstChild.textContent="Maya · Demo "; $("#matchInfo").textContent=`Scripted demo • ${language}`; $("#matchDot").style.background="#a78bfa";
  addSystem("No real stranger was available. You are now speaking with a scripted demo partner.");
  const greeting = language==="Tamil"?"வணக்கம்! எப்படி இருக்கீங்க? கொஞ்சம் பேசலாமா?":language==="Malayalam"?"ഹായ്! സുഖമാണോ? കുറച്ച് സംസാരിക്കാമോ?":language==="Telugu"?"హాయ్! ఎలా ఉన్నారు? కొంచెం మాట్లాడుదామా?":language==="Kannada"?"ಹಾಯ್! ಹೇಗಿದ್ದೀರಾ? ಸ್ವಲ್ಪ ಮಾತನಾಡೋಣವಾ?":language==="Hindi"?"हाय! कैसे हो? थोड़ी बात करें?":"Hey! How are you? Want to have a quick chat?";
  aiSpeak(greeting); addBubble(greeting,false);
}
function aiSpeak(text){
  const u=new SpeechSynthesisUtterance(text); u.lang={Tamil:"ta-IN",Malayalam:"ml-IN",Telugu:"te-IN",Kannada:"kn-IN",Hindi:"hi-IN",English:"en-IN"}[language]||"en-IN"; u.rate=.96; u.pitch=1.05;
  $("#aiAvatar").classList.add("ai-speaking"); u.onend=()=>$("#aiAvatar").classList.remove("ai-speaking"); speechSynthesis.cancel(); speechSynthesis.speak(u);
}
function aiReply(text){
  const lower=text.toLowerCase(); let reply;
  if(language==="Tamil") reply = text.includes("எப்படி")?"நான் நல்லா இருக்கேன்! நீங்க இப்ப என்ன பண்ணிக்கிட்டு இருக்கீங்க?":"சூப்பர்! இன்னும் கொஞ்சம் சொல்லுங்க, கேட்க நல்லா இருக்கு.";
  else if(language==="Malayalam") reply="അത് കേൾക്കാൻ നല്ലതാണ്! കുറച്ച് കൂടി പറയൂ, ഞാൻ കേൾക്കാം.";
  else if(language==="Telugu") reply="అది బాగుంది! ఇంకొంచెం చెప్పండి, నేను వింటున్నాను.";
  else if(language==="Kannada") reply="ಅದು ಚೆನ್ನಾಗಿದೆ! ಇನ್ನಷ್ಟು ಹೇಳಿ, ನಾನು ಕೇಳುತ್ತಿದ್ದೇನೆ.";
  else if(language==="Hindi") reply="बहुत बढ़िया! थोड़ा और बताइए, मैं सुन रही हूँ।";
  else reply="That sounds interesting! Tell me a little more about it.";
  setTimeout(()=>{addBubble(reply,false);aiSpeak(reply)},500+Math.random()*700);
}

async function setupPeer(){
  pc=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});
  localStream?.getTracks().forEach(t=>pc.addTrack(t,localStream));
  pc.ontrack=e=>{$("#remoteVideo").srcObject=e.streams[0]};
  pc.onicecandidate=e=>{if(e.candidate)send({type:"signal",data:{candidate:e.candidate}})};
  pc.onconnectionstatechange=()=>{if(["failed","disconnected"].includes(pc.connectionState))toast("Video connection interrupted.")};
  if(initiator){const offer=await pc.createOffer();await pc.setLocalDescription(offer);send({type:"signal",data:{sdp:pc.localDescription}})}
}
async function onSignal(d){
  if(!pc)await setupPeer();
  if(d.sdp){
    await pc.setRemoteDescription(d.sdp);
    if(d.sdp.type==="offer"){
      const answer=await pc.createAnswer();await pc.setLocalDescription(answer);send({type:"signal",data:{sdp:pc.localDescription}});
    }
  } else if(d.candidate){try{await pc.addIceCandidate(d.candidate)}catch{}}
}
$("#messageForm").onsubmit=e=>{
  e.preventDefault();const v=$("#messageInput").value.trim();if(!v)return;
  addBubble(v,true); $("#messageInput").value=""; if(aiMode) aiReply(v); else { send({type:"chat",text:v}); send({type:"typing",active:false}); }
};
$("#messageInput").oninput=()=>send({type:"typing",active:$("#messageInput").value.length>0});
function clearMessages(){$("#messages").innerHTML=""}
function addSystem(t){$("#messages").insertAdjacentHTML("beforeend",`<div class="system">${escapeHtml(t)}</div>`);scrollMsgs()}
function addBubble(t,me){$("#messages").insertAdjacentHTML("beforeend",`<div class="bubble ${me?"me":""}">${escapeHtml(t)}</div>`);scrollMsgs()}
function scrollMsgs(){$("#messages").scrollTop=$("#messages").scrollHeight}
function setTyping(v){$("#typing").classList.toggle("hidden",!v)}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

$("#skipBtn").onclick=()=>next();
$("#stopBtn").onclick=()=>{send({type:"leave"});cleanup();$("#chat").classList.add("hidden");$("#home").classList.remove("hidden")};
$("#backBtn").onclick=()=>$("#stopBtn").click();
function next(){speechSynthesis.cancel();aiMode=false;$("#aiAvatar").classList.add("hidden");$("#aiNotice").classList.add("hidden");send({type:"leave"});closePeer();clearMessages();addSystem("Finding your next conversation…");$("#matchDot").style.background="#64748b";$(".waiting").style.display="flex";queue()}
function closePeer(){if(pc){pc.close();pc=null}$("#remoteVideo").srcObject=null}
function cleanup(){closePeer();localStream?.getTracks().forEach(t=>t.stop());localStream=null;room=null}
$("#muteBtn").onclick=()=>{muted=!muted;localStream?.getAudioTracks().forEach(t=>t.enabled=!muted);$("#muteBtn").textContent=muted?"🔇 Unmute":"🎙 Mute"};
$("#camBtn").onclick=()=>{camOff=!camOff;localStream?.getVideoTracks().forEach(t=>t.enabled=!camOff);$("#camBtn").textContent=camOff?"🚫 Camera":"📷 Camera"};
$("#reportBtn").onclick=()=>{const reason=prompt("What happened?");if(reason){send({type:"report",reason});toast("Report submitted.")}};
$("#rulesBtn").onclick=()=>alert("Minglely is 18+ only. No nudity, harassment, hate speech, scams, spam, or sharing personal/financial information. Use Skip, Report and Block when needed.");







