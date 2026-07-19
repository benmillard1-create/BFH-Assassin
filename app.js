(() => {
"use strict";
const cfg=window.BFH_CONFIG||{};
const configured=Boolean(
 window.supabase &&
 cfg.SUPABASE_URL &&
 cfg.SUPABASE_ANON_KEY &&
 !String(cfg.SUPABASE_ANON_KEY).includes("PASTE_")
);
const sb=configured
 ? window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY)
 : null;
const $=id=>document.getElementById(id);
const views=["homeView","createView","joinView","loginView","managerView","lobbyView","gameView"];
const objects=["Wooden spoon","Oven glove","Tea towel","Small cushion","TV remote","Paperback book","Hand towel","Hairbrush","Pen","Pack of tissues","Phone charger","Torch","Folded umbrella","Reusable shopping bag","Tennis ball","Playing card","Dice","Water bottle","Sock","Scarf","Hat","Sunglasses","Coaster","Toothbrush"];
const objectIcons={
 "Wooden spoon":"🥄",
 "Oven glove":"🧤",
 "Tea towel":"🧻",
 "Small cushion":"🛋️",
 "TV remote":"📺",
 "Paperback book":"📖",
 "Hand towel":"🧺",
 "Hairbrush":"🪮",
 "Pen":"🖊️",
 "Pack of tissues":"🧻",
 "Phone charger":"🔌",
 "Torch":"🔦",
 "Folded umbrella":"☂️",
 "Reusable shopping bag":"🛍️",
 "Tennis ball":"🎾",
 "Playing card":"🃏",
 "Dice":"🎲",
 "Water bottle":"🚰",
 "Sock":"🧦",
 "Scarf":"🧣",
 "Hat":"🎩",
 "Sunglasses":"🕶️",
 "Coaster":"⭕",
 "Toothbrush":"🪥"
};
function objectDisplayName(name){
 const icon=objectIcons[name]||"●";
 return `${icon} ${name}`;
}
const rooms=["Butlers’ Kitchen","Main Kitchen","Breakfast Room","Main Hall","Drawing Room","Dining Room","Study","Snug","Inner Hall","Pantry","Wellness Complex","Hot Tub","Stables Kitchen","Sitting Room","Portico","Driveway","Garden","Tennis Court","Bridge over Pond"];
let session=JSON.parse(localStorage.getItem("bfh_session")||"null");
let timer=null;
let briefingTimer=null;
let briefingIndex=0;
let briefingOnFinish=null;
let briefingAuto=false;
const briefingSlides=Array.from({length:18},(_,i)=>`briefing/slide-${String(i+1).padStart(2,"0")}.jpg`);
let latestBoard=[];
let latestHostPlayerId=null;
function missionRevealKey(){return session?.gameId&&session?.playerId?`bfh_mission_revealed_v237_${session.gameId}_${session.playerId}`:""}
function creditsSeenKey(){return session?.gameId?`bfh_credits_seen_${session.gameId}`:""}

function showView(id){views.forEach(v=>$(v).classList.toggle("hidden",v!==id))}
function msg(t,e=false,stay=false){const b=$("message");b.textContent=t;b.classList.toggle("error",e);b.classList.remove("hidden");if(!stay)setTimeout(()=>b.classList.add("hidden"),8000)}
function save(s){session={...s,savedAt:new Date().toISOString()};localStorage.setItem("bfh_session",JSON.stringify(session))}
function clear(){session=null;localStorage.removeItem("bfh_session")}
function openFloorPlan(){const modal=$("floorPlanModal");modal.classList.remove("hidden");document.body.classList.add("modalOpen");$("closeFloorPlanBtn").focus()}
function closeFloorPlan(){$("floorPlanModal").classList.add("hidden");if($("rulesModal").classList.contains("hidden"))document.body.classList.remove("modalOpen")}
function openRules(){$("rulesModal").classList.remove("hidden");document.body.classList.add("modalOpen");$("closeRulesBtn").focus()}
function closeRules(){$("rulesModal").classList.add("hidden");if($("floorPlanModal").classList.contains("hidden")&&$("briefingModal").classList.contains("hidden"))document.body.classList.remove("modalOpen")}
function briefingSeenKey(){return session?.gameId&&session?.playerId?`bfh_briefing_seen_${session.gameId}_${session.playerId}`:""}
function hasSeenBriefing(){const key=briefingSeenKey();return key&&localStorage.getItem(key)==="yes"}
function markBriefingSeen(){const key=briefingSeenKey();if(key)localStorage.setItem(key,"yes")}
function briefingAudio(){return $("briefingAudio")}
function stopBriefingAudio(fade=true){
 const audio=briefingAudio();
 if(!audio)return;
 if(!fade){audio.pause();audio.currentTime=0;audio.volume=1;return}
 const startVolume=audio.volume||1;
 const started=performance.now();
 const fadeMs=850;
 function step(now){
  const progress=Math.min(1,(now-started)/fadeMs);
  audio.volume=Math.max(0,startVolume*(1-progress));
  if(progress<1&&!audio.paused)requestAnimationFrame(step);
  else{audio.pause();audio.currentTime=0;audio.volume=1}
 }
 requestAnimationFrame(step);
}
function renderBriefingSlide(){
 const image=$("briefingImage");
 image.src=briefingSlides[briefingIndex];
 image.alt=`Mission briefing slide ${briefingIndex+1} of ${briefingSlides.length}`;
 $("briefingCounter").textContent=`${briefingIndex+1} / ${briefingSlides.length}`;
 $("briefingProgressBar").style.width=`${((briefingIndex+1)/briefingSlides.length)*100}%`;
 image.classList.remove("fadeOut");
}
function scheduleBriefingSlide(){
 clearTimeout(briefingTimer);
 const audio=briefingAudio();
 const totalMs=(Number.isFinite(audio?.duration)&&audio.duration>1?audio.duration:43.8)*1000;
 const slideMs=totalMs/briefingSlides.length;
 const fadeMs=Math.min(450,slideMs*.24);
 briefingTimer=setTimeout(()=>{
  $("briefingImage").classList.add("fadeOut");
  briefingTimer=setTimeout(()=>{
   if(briefingIndex>=briefingSlides.length-1)return finishBriefing(false);
   briefingIndex+=1;renderBriefingSlide();scheduleBriefingSlide();
  },fadeMs);
 },Math.max(250,slideMs-fadeMs));
}
function hideBriefingCountdown(){
 $("briefingCountdown").classList.add("hidden");
 $("briefingTapBtn").classList.add("hidden");
}
function startBriefingPresentation(){
 hideBriefingCountdown();
 briefingIndex=0;
 renderBriefingSlide();
 scheduleBriefingSlide();
}
async function beginBriefingCountdown(){
 clearTimeout(briefingTimer);
 const overlay=$("briefingCountdown");
 const number=$("briefingCountdownNumber");
 const tap=$("briefingTapBtn");
 overlay.classList.remove("hidden");tap.classList.add("hidden");
 const audio=briefingAudio();
 audio.pause();audio.currentTime=0;audio.volume=1;
 try{await audio.play();audio.pause();audio.currentTime=0}
 catch(_){
  number.textContent="";tap.classList.remove("hidden");tap.focus();return;
 }
 let count=3;number.textContent=String(count);
 const tick=()=>{
  if(count<=1){
   audio.play().then(startBriefingPresentation).catch(()=>{
    number.textContent="";tap.classList.remove("hidden");tap.focus();
   });
   return;
  }
  count-=1;number.textContent=String(count);briefingTimer=setTimeout(tick,1000);
 };
 briefingTimer=setTimeout(tick,1000);
}
async function tapToBeginBriefing(){
 const audio=briefingAudio();
 try{audio.currentTime=0;audio.volume=1;await audio.play();startBriefingPresentation()}
 catch(_){msg("Tap again to allow the mission briefing music.",true)}
}
function playBriefing(onFinish=null,isAuto=false){
 clearInterval(timer);clearTimeout(briefingTimer);stopBriefingAudio(false);
 briefingOnFinish=onFinish;briefingAuto=isAuto;briefingIndex=0;
 $("briefingModal").classList.remove("hidden");document.body.classList.add("modalOpen");
 $("closeBriefingBtn").classList.toggle("hidden",isAuto);
 $("briefingSkipBtn").textContent=isAuto?"Skip to mission":"Close briefing";
 renderBriefingSlide();beginBriefingCountdown();
}
function finishBriefing(fadeAudio=true){
 clearTimeout(briefingTimer);hideBriefingCountdown();stopBriefingAudio(fadeAudio);$("briefingModal").classList.add("hidden");
 if($("rulesModal").classList.contains("hidden")&&$("floorPlanModal").classList.contains("hidden"))document.body.classList.remove("modalOpen");
 const callback=briefingOnFinish;const wasAuto=briefingAuto;briefingOnFinish=null;briefingAuto=false;
 if(wasAuto)markBriefingSeen();
 if(callback)setTimeout(callback,fadeAudio?900:0);
}
function replayBriefing(){stopBriefingAudio(false);beginBriefingCountdown()}
function openGameAfterBriefing(){
 clearInterval(timer);
 if(hasSeenBriefing())return openGame();
 playBriefing(openGame,true);
}
let missionRevealStep=0;
function activateMissionPanel(){
 document.querySelectorAll(".tab").forEach(tab=>tab.classList.toggle("active",tab.dataset.tab==="missionPanel"));
 ["missionPanel","boardPanel","feedPanel"].forEach(id=>{
  const panel=$(id);
  if(panel)panel.classList.toggle("hidden",id!=="missionPanel");
 });
}
function renderMissionRevealStep(){
 const modal=$("missionRevealModal");
 if(!modal)return;
 modal.querySelectorAll("[data-mission-step]").forEach(card=>card.classList.toggle("active",Number(card.dataset.missionStep)===missionRevealStep));
 modal.querySelectorAll(".revealStepDots span").forEach((dot,index)=>dot.classList.toggle("active",index===missionRevealStep));
}
function openMissionReveal(){
 const modal=$("missionRevealModal");if(!modal)return;
 // Put the real mission panel underneath the privacy overlay first.
 activateMissionPanel();
 missionRevealStep=0;
 $("missionRevealName").textContent=session?.playerName||"Agent";
 $("revealTargetName").textContent=$("targetName")?.textContent||"—";
 $("revealObjectName").textContent=$("objectName")?.textContent||"—";
 $("revealRoomName").textContent=$("roomName")?.textContent||"—";
 modal.className="missionRevealModal";
 modal.setAttribute("aria-hidden","false");
 document.body.classList.add("modalOpen");
 renderMissionRevealStep();
 setTimeout(()=>$("missionRevealStage")?.focus(),80);
}
function advanceMissionReveal(event){
 event?.preventDefault();
 const target=event?.target;
 if(target?.closest?.("#closeMissionRevealBtn"))return;
 if(missionRevealStep<4){
  missionRevealStep+=1;
  renderMissionRevealStep();
  if(missionRevealStep===4)setTimeout(()=>$("closeMissionRevealBtn")?.focus(),80);
 }
}
function closeMissionReveal(){
 const key=missionRevealKey();if(key)localStorage.setItem(key,"yes");
 activateMissionPanel();
 const modal=$("missionRevealModal");
 if(modal){modal.classList.add("hidden");modal.setAttribute("aria-hidden","true");}
 if($("briefingModal").classList.contains("hidden")&&$("rulesModal").classList.contains("hidden")&&$("floorPlanModal").classList.contains("hidden")&&$("creditsModal").classList.contains("hidden"))document.body.classList.remove("modalOpen");
 // The mission panel is already underneath; no navigation or reload is needed.
}
function maybeOpenMissionReveal(hasMission){
 const key=missionRevealKey();if(hasMission&&key&&localStorage.getItem(key)!=="yes"&&$("missionRevealModal").classList.contains("hidden"))setTimeout(openMissionReveal,300);
}

function openCredits(force=false){
 if(!latestBoard.length)return;
 const modal=$("creditsModal");if(!modal)return;
 const key=creditsSeenKey();if(!force&&key&&localStorage.getItem(key)==="yes")return;
 const host=latestBoard.find(x=>x.id===latestHostPlayerId);
 $("creditsHost").textContent=host?.name||session?.playerName||"The Host";
 const cast=$("creditsCast");cast.innerHTML="";
 latestBoard.forEach(x=>{const row=document.createElement("div");row.className="creditsCastRow";row.textContent=x.name;cast.append(row)});
 modal.classList.remove("hidden");document.body.classList.add("modalOpen");
 modal.classList.remove("rolling");void modal.offsetWidth;modal.classList.add("rolling");
 if(key)localStorage.setItem(key,"yes");
 $("creditsAudio").currentTime=0;$("creditsAudio").volume=.62;$("creditsAudio").play().catch(()=>{});
}
function closeCredits(){
 const audio=$("creditsAudio");audio.pause();audio.currentTime=0;
 $("creditsModal").classList.add("hidden");
 if($("briefingModal").classList.contains("hidden")&&$("rulesModal").classList.contains("hidden")&&$("floorPlanModal").classList.contains("hidden")&&$("missionRevealModal").classList.contains("hidden"))document.body.classList.remove("modalOpen");
}
function validPin(v){return /^[0-9]{4}$/.test(v)}
function randCode(){const c="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";return Array.from({length:6},()=>c[Math.floor(Math.random()*c.length)]).join("")}
function shuffle(a){
 const copy=[...a];
 for(let i=copy.length-1;i>0;i--){
  const j=Math.floor(Math.random()*(i+1));
  [copy[i],copy[j]]=[copy[j],copy[i]];
 }
 return copy;
}
function dealUniqueUntilExhausted(pool,count){
 const dealt=[];
 while(dealt.length<count){
  const cycle=shuffle(pool);
  dealt.push(...cycle.slice(0,count-dealt.length));
 }
 return dealt;
}
async function uniqueCode(){for(let i=0;i<10;i++){const c=randCode();const {data,error}=await sb.from("games").select("id").eq("code",c).limit(1);if(error)throw error;if(!data.length)return c}throw Error("Could not create a unique code")}

async function createGame(event){
 event?.preventDefault();
 const name=$("hostName").value.trim(),pin=$("hostPin").value.trim();
 if(!name||!validPin(pin))return msg("Enter your name and a 4-digit PIN.",true);
 try{
  const code=await uniqueCode();
  const {data:g,error:ge}=await sb.from("games").insert({code,host_name:name,status:"waiting"}).select("id,code").single();if(ge)throw ge;
  const {data:p,error:pe}=await sb.from("players").insert({game_id:g.id,name,status:"alive",alive:true}).select("id,name").single();if(pe)throw pe;
  const {error:se}=await sb.rpc("set_player_pin",{p_player_id:p.id,p_pin:pin});if(se)throw se;
  const {error:he}=await sb.from("games").update({host_player_id:p.id}).eq("id",g.id);
  if(he)throw he;
  const {error:ee}=await sb.from("game_events").insert({game_id:g.id,event_type:"join",message:`${name} created the game.`});
  if(ee)throw ee;
  save({gameId:g.id,code:g.code,playerId:p.id,playerName:p.name,isHost:true});
  openLobby();
 }catch(e){msg("Could not create game: "+e.message,true)}
}

async function joinGame(event){
 event?.preventDefault();
 const code=$("joinCode").value.trim().toUpperCase(),name=$("playerName").value.trim(),pin=$("playerPin").value.trim();
 if(code.length!==6||!name||!validPin(pin))return msg("Enter the code, your name, and a 4-digit PIN.",true);
 try{
  const {data:g,error:ge}=await sb.from("games").select("id,code,status").eq("code",code).maybeSingle();if(ge)throw ge;if(!g)throw Error("Game not found");if(g.status!=="waiting")throw Error("This game has already started");
  const {data:d,error:de}=await sb.from("players").select("id").eq("game_id",g.id).ilike("name",name).limit(1);if(de)throw de;if(d.length)throw Error("That name is already in use");
  const {data:p,error:pe}=await sb.from("players").insert({game_id:g.id,name,status:"alive",alive:true}).select("id,name").single();if(pe)throw pe;
  const {error:se}=await sb.rpc("set_player_pin",{p_player_id:p.id,p_pin:pin});if(se)throw se;
  const {error:ee}=await sb.from("game_events").insert({game_id:g.id,event_type:"join",message:`${name} joined the game.`});
  if(ee)throw ee;
  save({gameId:g.id,code:g.code,playerId:p.id,playerName:p.name,isHost:false});
  openLobby();
 }catch(e){msg("Could not join: "+e.message,true)}
}

async function login(event){
 event?.preventDefault();
 const code=$("loginCode").value.trim().toUpperCase(),name=$("loginName").value.trim(),pin=$("loginPin").value.trim();
 if(!code||!name||!validPin(pin))return msg("Enter your game code, name, and PIN.",true);
 const {data,error}=await sb.rpc("player_login",{p_game_code:code,p_name:name,p_pin:pin});
 if(error)return msg("Login failed: "+error.message,true);
 if(!data?.length)return msg("Name, code, or PIN was incorrect.",true);
 const r=data[0];save({gameId:r.game_id,code:r.game_code,playerId:r.player_id,playerName:r.player_name,isHost:r.is_host});
 r.game_status==="waiting"?openLobby():openGameAfterBriefing();
}

async function loadLobby(){
 if(!session)return;
 const {data:g,error:ge}=await sb.from("games").select("id,code,host_player_id,status").eq("id",session.gameId).maybeSingle();
 if(ge){
  clearInterval(timer);
  showView("lobbyView");
  msg("Could not load lobby: "+ge.message,true);
  return;
 }
 if(!g){
  clearInterval(timer);
  msg("This game could not be found.",true);
  return;
 }
 if(g.status!=="waiting")return openGameAfterBriefing();
 const {data:ps,error:pe}=await sb.from("players").select("id,name").eq("game_id",session.gameId).order("created_at");
 if(pe)return msg(pe.message,true);
 session.isHost=g.host_player_id===session.playerId;save(session);
 $("lobbyCode").textContent=g.code;$("roleBadge").textContent=session.isHost?"HOST":"PLAYER";$("playerCount").textContent=ps.length;
 $("startGameBtn").classList.toggle("hidden",!session.isHost);$("waitingText").classList.toggle("hidden",session.isHost);
 $("deleteCurrentGameBtn")?.classList.toggle("hidden",!session.isHost);
 const l=$("playerList");l.innerHTML="";ps.forEach(p=>{const li=document.createElement("li"),name=document.createElement("span"),status=document.createElement("small");name.className="name";name.textContent=p.name;status.textContent=p.id===g.host_player_id?"Host":p.id===session.playerId?"You":"Ready";li.append(name,status);l.append(li)});
}

async function dealMissions(event){
 event?.preventDefault();
 try{
  const {data:ps,error:pe}=await sb.from("players").select("id,name").eq("game_id",session.gameId);if(pe)throw pe;
  if(ps.length<3)throw Error("At least 3 players are needed");
  const ordered=shuffle(ps);
  const dealtObjects=dealUniqueUntilExhausted(objects,ordered.length);
  const dealtRooms=dealUniqueUntilExhausted(rooms,ordered.length);
  const rows=ordered.map((p,i)=>({
   game_id:session.gameId,
   player_id:p.id,
   target_player_id:ordered[(i+1)%ordered.length].id,
   object_name:dealtObjects[i],
   room_name:dealtRooms[i],
   completed:false
  }));
  const {error:me}=await sb.from("missions").insert(rows);if(me)throw me;
  const {error:ge}=await sb.from("games").update({status:"started",started_at:new Date().toISOString()}).eq("id",session.gameId);if(ge)throw ge;
  await sb.from("game_events").insert({game_id:session.gameId,event_type:"start",message:"The game has started. Secret missions have been assigned."});
  openGameAfterBriefing();
 }catch(e){msg("Could not start game: "+e.message,true)}
}

async function loadGame(){
 if(!session)return;
 const [{data:g,error:ge},{data:p,error:pe},{data:m,error:me},{data:board,error:be},{data:events,error:ee}]=await Promise.all([
  sb.from("games").select("host_player_id,status").eq("id",session.gameId).maybeSingle(),
  sb.from("players").select("id,name,status,mission_completed").eq("id",session.playerId).maybeSingle(),
  sb.from("missions").select("id,object_name,room_name,completed,target_player_id,players!missions_target_player_id_fkey(name)").eq("player_id",session.playerId).maybeSingle(),
  sb.from("players").select("id,name,status,mission_completed").eq("game_id",session.gameId).order("name"),
  sb.from("game_events").select("id,message,created_at").eq("game_id",session.gameId).order("created_at",{ascending:false}).limit(40)
 ]);
 if(ge||pe||be||ee)return msg((ge||pe||be||ee).message,true);
 session.isHost=g?.host_player_id===session.playerId;latestHostPlayerId=g?.host_player_id||null;save(session);
 $("deleteCurrentGameInPlayBtn")?.classList.toggle("hidden",!session.isHost);
 $("missionPlayerName").textContent=p?.name||session.playerName;
 if($("sidePlayerName")) $("sidePlayerName").textContent=p?.name||session.playerName;
 if($("gameCodeDisplay")) $("gameCodeDisplay").textContent=session.code||"------";
 const hasMission=!!m;$("missionWaiting").classList.toggle("hidden",hasMission);$("missionDetails").classList.toggle("hidden",!hasMission);maybeOpenMissionReveal(hasMission);
 if(m){$("targetName").textContent=m.players?.name||"Unknown";$("objectName").textContent=objectDisplayName(m.object_name);$("roomName").textContent=m.room_name}
 const completed=!!m?.completed;const ghost=p?.status==="ghost";
 $("missionStatusBadge").textContent=completed?"COMPLETE":ghost?"GHOST":"ACTIVE";
 if($("sideStatus")) $("sideStatus").textContent=completed?"✓ Mission complete":ghost?"● Ghost":"● Active";
 $("missionHint").textContent=completed?"Your mission is complete.":ghost?"You are a ghost, but your mission is still active.":"Keep this screen private.";
 $("missionCompleteBtn").classList.toggle("hidden",!m||completed);
 latestBoard=board||[];const b=$("statusBoard");b.innerHTML="";(board||[]).forEach(x=>{
  const li=document.createElement("li");
  const name=document.createElement("strong");
  const statuses=document.createElement("div");
  const life=document.createElement("span");
  const mission=document.createElement("span");
  li.className="boardPlayerRow";
  name.className="boardPlayerName";name.textContent=x.name;
  statuses.className="boardStatuses";
  life.className=x.status==="ghost"?"boardStatus boardStatusGhost":"boardStatus boardStatusAlive";
  life.textContent=x.status==="ghost"?"Ghost":"Alive";
  mission.className=x.mission_completed?"boardStatus boardStatusComplete":"boardStatus boardStatusPending";
  mission.textContent=x.mission_completed?"Mission complete":"Mission pending";
  statuses.append(life,mission);li.append(name,statuses);b.append(li);
 });
 const f=$("eventFeed");f.innerHTML="";(events||[]).forEach(x=>{const li=document.createElement("li");li.textContent=x.message;const t=document.createElement("time");t.textContent=new Date(x.created_at).toLocaleString();li.append(t);f.append(li)});
 const allComplete=(board||[]).length>=3&&(board||[]).every(x=>x.mission_completed);
 $("watchCreditsBtn")?.classList.toggle("hidden",!allComplete);
 if(allComplete)setTimeout(()=>openCredits(false),700);
}

async function completeMission(event){
 event?.preventDefault();
 if(!confirm("Confirm that you completed your mission?"))return;
 try{
  const {data:m,error:me}=await sb.from("missions").select("id,target_player_id,completed,object_name,room_name").eq("player_id",session.playerId).maybeSingle();if(me)throw me;if(!m||m.completed)throw Error("Mission is already complete");
  const {data:k,error:ke}=await sb.from("players").select("name,status").eq("id",session.playerId).single();if(ke)throw ke;
  const {data:t,error:te}=await sb.from("players").select("name,status").eq("id",m.target_player_id).single();if(te)throw te;
  await sb.from("missions").update({completed:true,completed_at:new Date().toISOString()}).eq("id",m.id);
  await sb.from("players").update({mission_completed:true}).eq("id",session.playerId);
  if(t.status!=="ghost")await sb.from("players").update({status:"ghost",alive:false}).eq("id",m.target_player_id);
  await sb.from("game_events").insert({
   game_id:session.gameId,
   event_type:"elimination",
   message:`${k.name} eliminated ${t.name} with the ${m.object_name} in the ${m.room_name}.`
  });
  msg("Mission recorded.");loadGame();
 }catch(e){msg(e.message,true)}
}

async function deletePreviousGames(){
 const name=$("managerHostName").value.trim(),pin=$("managerHostPin").value.trim();
 if(!name||!validPin(pin))return msg("Enter the host name and 4-digit PIN.",true);
 if(!confirm("Delete every previous game for this host? Your newest game will be kept. This cannot be undone."))return;
 const button=$("deletePreviousGamesBtn");
 button.disabled=true;
 const oldText=button.textContent;
 button.textContent="Deleting…";
 try{
  const {data,error}=await sb.rpc("delete_previous_host_games",{p_host_name:name,p_pin:pin});
  if(error)throw error;
  const count=Number(data||0);
  msg(count
   ? `${count} previous game${count===1?"":"s"} deleted. Your newest game was kept.`
   : "There were no previous games to delete.");
 }catch(error){
  msg("Could not delete previous games: "+error.message,true);
 }finally{
  button.disabled=false;
  button.textContent=oldText;
 }
}

async function deleteCurrentGame(){
 if(!session?.isHost)return msg("Only the host can delete this game.",true);
 const pin=prompt("Enter your 4-digit host PIN to permanently delete this game:");
 if(pin===null)return;if(!validPin(pin))return msg("Enter a valid 4-digit PIN.",true);
 if(!confirm(`Delete game ${session.code}? All players, missions and history will be removed.`))return;
 const {error}=await sb.rpc("delete_host_game",{p_game_id:session.gameId,p_host_name:session.playerName,p_pin:pin});
 if(error)return msg("Could not delete game: "+error.message,true);
 clearInterval(timer);clear();showView("homeView");msg("Game deleted.");
}

function openLobby(){showView("lobbyView");clearInterval(timer);loadLobby();timer=setInterval(loadLobby,2500)}
function openGame(){showView("gameView");clearInterval(timer);loadGame();timer=setInterval(loadGame,2500)}
function logout(){
 clearInterval(timer);
 clear();
 showView("homeView");
}
function switchPlayer(){
 const rememberedCode=session?.code||"";
 clearInterval(timer);
 clear();
 $("loginCode").value=rememberedCode;
 $("loginName").value="";
 $("loginPin").value="";
 showView("loginView");
 setTimeout(()=>$("loginName").focus(),50);
}
function init(){
 // Navigation must work even when Supabase is not configured.
 $("showCreateBtn").onclick=()=>showView("createView");
 $("showJoinBtn").onclick=()=>showView("joinView");
 $("showLoginBtn").onclick=()=>showView("loginView");
 $("showManagerBtn").onclick=()=>showView("managerView");
 $("deletePreviousGamesBtn").onclick=deletePreviousGames;
 $("deleteCurrentGameBtn").onclick=deleteCurrentGame;
 $("deleteCurrentGameInPlayBtn").onclick=deleteCurrentGame;
 document.querySelectorAll("[data-home]").forEach(button=>{
  button.onclick=event=>{
   event.preventDefault();
   showView("homeView");
  };
 });

 ["hostPin","playerPin","loginPin","managerHostPin"].forEach(id=>{
  $(id).oninput=event=>{
   event.target.value=event.target.value.replace(/\D/g,"").slice(0,4);
  };
 });
 ["joinCode","loginCode"].forEach(id=>{
  $(id).oninput=event=>{
   event.target.value=event.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6);
  };
 });

 $("createGameBtn").onclick=createGame;
 $("joinGameBtn").onclick=joinGame;
 $("loginBtn").onclick=login;
 $("startGameBtn").onclick=dealMissions;
 $("copyCodeBtn").onclick=async()=>{
  try{
   await navigator.clipboard.writeText(session.code);
   msg("Code copied.");
  }catch{
   msg("Game code: "+session.code);
  }
 };
 $("switchPlayerBtn").onclick=switchPlayer;
 $("leaveGameBtn").onclick=logout;
 $("hideMissionBtn").onclick=switchPlayer;
 $("missionCompleteBtn").onclick=completeMission;
 $("revealMissionBtn").onclick=openMissionReveal;
 $("replayMissionRevealBtn").onclick=openMissionReveal;
 $("missionRevealStage").onclick=advanceMissionReveal;
 $("missionRevealStage").onkeydown=event=>{if((event.key==="Enter"||event.key===" ")&&!event.target.closest("#closeMissionRevealBtn"))advanceMissionReveal(event)};
 $("closeMissionRevealBtn").onclick=event=>{event.preventDefault();event.stopPropagation();closeMissionReveal()};
 $("watchCreditsBtn").onclick=()=>openCredits(true);
 $("closeCreditsBtn").onclick=closeCredits;
 $("creditsModal").onclick=event=>{if(event.target.id==="creditsModal")closeCredits()};
 document.querySelectorAll("[data-floor-plan]").forEach(button=>{button.onclick=openFloorPlan;button.onkeydown=event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();openFloorPlan()}}});
 document.querySelectorAll("[data-open-tab]").forEach(button=>button.onclick=()=>{if(!session?.gameId)return;openGame();setTimeout(()=>document.querySelector(`.tab[data-tab="${button.dataset.openTab}"]`)?.click(),0)});
 $("openRulesBtn").onclick=openRules;
 $("openBriefingBtn").onclick=()=>playBriefing(null,false);
 $("briefingReplayBtn").onclick=replayBriefing;
 $("briefingTapBtn").onclick=tapToBeginBriefing;
 $("briefingSkipBtn").onclick=finishBriefing;
 $("closeBriefingBtn").onclick=finishBriefing;
 $("briefingModal").onclick=event=>{if(event.target.id==="briefingModal"&&!briefingAuto)finishBriefing()};
 $("closeRulesBtn").onclick=closeRules;
 $("rulesModal").onclick=event=>{if(event.target.id==="rulesModal")closeRules()};
 $("closeFloorPlanBtn").onclick=closeFloorPlan;
 $("floorPlanModal").onclick=event=>{if(event.target.id==="floorPlanModal")closeFloorPlan()};
 document.addEventListener("keydown",event=>{
  if(event.key!=="Escape")return;
  if(!$("creditsModal").classList.contains("hidden"))closeCredits();
  else if(!$("missionRevealModal").classList.contains("hidden"))closeMissionReveal(true);
  else if(!$("briefingModal").classList.contains("hidden")&&!briefingAuto)finishBriefing();
  else if(!$("rulesModal").classList.contains("hidden"))closeRules();
  else if(!$("floorPlanModal").classList.contains("hidden"))closeFloorPlan();
 });

 document.querySelectorAll(".tab").forEach(tab=>{
  tab.onclick=()=>{
   document.querySelectorAll(".tab").forEach(item=>item.classList.remove("active"));
   tab.classList.add("active");
   ["missionPanel","boardPanel","feedPanel"].forEach(id=>{
    $(id).classList.toggle("hidden",id!==tab.dataset.tab);
   });
  };
 });

 if(!configured){
  msg("Paste your Supabase anon key into config.js.",true);
  return;
 }

 if(session?.gameId){
  // Open the remembered screen immediately. Never erase a newly created
  // session merely because the first network/schema check fails.
  showView("lobbyView");
  sb.from("games")
   .select("status")
   .eq("id",session.gameId)
   .maybeSingle()
   .then(({data,error})=>{
    if(error){
     showView("lobbyView");
     msg("Session saved, but Supabase could not reload the game: "+error.message,true,true);
     return;
    }
    if(!data){
     showView("lobbyView");
     msg("Session saved, but this game record could not be found.",true,true);
     return;
    }
    data.status==="waiting"?openLobby():openGameAfterBriefing();
   });
 }
}
addEventListener("DOMContentLoaded",init);
})();
