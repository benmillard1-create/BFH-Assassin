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
const views=["homeView","createView","joinView","loginView","lobbyView","gameView"];
const objects=["Wooden spoon","Tea towel","Cushion","Mug","Book","Remote control","Sock","Coaster","Hairbrush","Water bottle","Oven glove","Tissue box"];
const rooms=["Kitchen","Living room","Dining room","Hallway","Garden","Bedroom","Bathroom","Patio","Utility room"];
let session=JSON.parse(localStorage.getItem("bfh_session")||"null");
let timer=null;

function showView(id){views.forEach(v=>$(v).classList.toggle("hidden",v!==id))}
function msg(t,e=false){const b=$("message");b.textContent=t;b.classList.toggle("error",e);b.classList.remove("hidden");setTimeout(()=>b.classList.add("hidden"),5000)}
function save(s){session=s;localStorage.setItem("bfh_session",JSON.stringify(s))}
function clear(){session=null;localStorage.removeItem("bfh_session")}
function validPin(v){return /^[0-9]{4}$/.test(v)}
function randCode(){const c="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";return Array.from({length:6},()=>c[Math.floor(Math.random()*c.length)]).join("")}
function shuffle(a){return [...a].sort(()=>Math.random()-.5)}
async function uniqueCode(){for(let i=0;i<10;i++){const c=randCode();const {data,error}=await sb.from("games").select("id").eq("code",c).limit(1);if(error)throw error;if(!data.length)return c}throw Error("Could not create a unique code")}

async function createGame(){
 const name=$("hostName").value.trim(),pin=$("hostPin").value.trim();
 if(!name||!validPin(pin))return msg("Enter your name and a 4-digit PIN.",true);
 try{
  const code=await uniqueCode();
  const {data:g,error:ge}=await sb.from("games").insert({code,host_name:name,status:"waiting"}).select("id,code").single();if(ge)throw ge;
  const {data:p,error:pe}=await sb.from("players").insert({game_id:g.id,name,status:"alive",alive:true}).select("id,name").single();if(pe)throw pe;
  const {error:se}=await sb.rpc("set_player_pin",{p_player_id:p.id,p_pin:pin});if(se)throw se;
  await sb.from("games").update({host_player_id:p.id}).eq("id",g.id);
  await sb.from("game_events").insert({game_id:g.id,event_type:"join",message:`${name} created the game.`});
  save({gameId:g.id,code:g.code,playerId:p.id,playerName:p.name,isHost:true});openLobby();
 }catch(e){msg("Could not create game: "+e.message,true)}
}

async function joinGame(){
 const code=$("joinCode").value.trim().toUpperCase(),name=$("playerName").value.trim(),pin=$("playerPin").value.trim();
 if(code.length!==6||!name||!validPin(pin))return msg("Enter the code, your name, and a 4-digit PIN.",true);
 try{
  const {data:g,error:ge}=await sb.from("games").select("id,code,status").eq("code",code).maybeSingle();if(ge)throw ge;if(!g)throw Error("Game not found");if(g.status!=="waiting")throw Error("This game has already started");
  const {data:d,error:de}=await sb.from("players").select("id").eq("game_id",g.id).ilike("name",name).limit(1);if(de)throw de;if(d.length)throw Error("That name is already in use");
  const {data:p,error:pe}=await sb.from("players").insert({game_id:g.id,name,status:"alive",alive:true}).select("id,name").single();if(pe)throw pe;
  const {error:se}=await sb.rpc("set_player_pin",{p_player_id:p.id,p_pin:pin});if(se)throw se;
  await sb.from("game_events").insert({game_id:g.id,event_type:"join",message:`${name} joined the game.`});
  save({gameId:g.id,code:g.code,playerId:p.id,playerName:p.name,isHost:false});openLobby();
 }catch(e){msg("Could not join: "+e.message,true)}
}

async function login(){
 const code=$("loginCode").value.trim().toUpperCase(),name=$("loginName").value.trim(),pin=$("loginPin").value.trim();
 if(!code||!name||!validPin(pin))return msg("Enter your game code, name, and PIN.",true);
 const {data,error}=await sb.rpc("player_login",{p_game_code:code,p_name:name,p_pin:pin});
 if(error)return msg("Login failed: "+error.message,true);
 if(!data?.length)return msg("Name, code, or PIN was incorrect.",true);
 const r=data[0];save({gameId:r.game_id,code:r.game_code,playerId:r.player_id,playerName:r.player_name,isHost:r.is_host});
 r.game_status==="waiting"?openLobby():openGame();
}

async function loadLobby(){
 if(!session)return;
 const {data:g,error:ge}=await sb.from("games").select("id,code,host_player_id,status").eq("id",session.gameId).maybeSingle();
 if(ge||!g)return logout();
 if(g.status!=="waiting")return openGame();
 const {data:ps,error:pe}=await sb.from("players").select("id,name").eq("game_id",session.gameId).order("created_at");
 if(pe)return msg(pe.message,true);
 session.isHost=g.host_player_id===session.playerId;save(session);
 $("lobbyCode").textContent=g.code;$("roleBadge").textContent=session.isHost?"HOST":"PLAYER";$("playerCount").textContent=ps.length;
 $("startGameBtn").classList.toggle("hidden",!session.isHost);$("waitingText").classList.toggle("hidden",session.isHost);
 const l=$("playerList");l.innerHTML="";ps.forEach(p=>{const li=document.createElement("li"),n=document.createElement("span"),s=document.createElement("small");n.className="name";n.textContent=p.name;s.textContent=p.id===g.host_player_id?"Host":p.id===session.playerId?"You":"Ready";li.append(n,s);l.append(li)});
}

async function dealMissions(){
 try{
  const {data:ps,error:pe}=await sb.from("players").select("id,name").eq("game_id",session.gameId);if(pe)throw pe;
  if(ps.length<3)throw Error("At least 3 players are needed");
  const ordered=shuffle(ps),rows=ordered.map((p,i)=>({game_id:session.gameId,player_id:p.id,target_player_id:ordered[(i+1)%ordered.length].id,object_name:objects[Math.floor(Math.random()*objects.length)],room_name:rooms[Math.floor(Math.random()*rooms.length)],completed:false}));
  const {error:me}=await sb.from("missions").insert(rows);if(me)throw me;
  const {error:ge}=await sb.from("games").update({status:"started",started_at:new Date().toISOString()}).eq("id",session.gameId);if(ge)throw ge;
  await sb.from("game_events").insert({game_id:session.gameId,event_type:"start",message:"The game has started. Secret missions have been assigned."});
  openGame();
 }catch(e){msg("Could not start game: "+e.message,true)}
}

async function loadGame(){
 if(!session)return;
 const [{data:p,error:pe},{data:m,error:me},{data:board,error:be},{data:events,error:ee}]=await Promise.all([
  sb.from("players").select("id,name,status,mission_completed").eq("id",session.playerId).maybeSingle(),
  sb.from("missions").select("id,object_name,room_name,completed,target_player_id,players!missions_target_player_id_fkey(name)").eq("player_id",session.playerId).maybeSingle(),
  sb.from("players").select("id,name,status,mission_completed").eq("game_id",session.gameId).order("name"),
  sb.from("game_events").select("id,message,created_at").eq("game_id",session.gameId).order("created_at",{ascending:false}).limit(40)
 ]);
 if(pe||be||ee)return msg((pe||be||ee).message,true);
 $("missionPlayerName").textContent=p?.name||session.playerName;
 const hasMission=!!m;$("missionWaiting").classList.toggle("hidden",hasMission);$("missionDetails").classList.toggle("hidden",!hasMission);
 if(m){$("targetName").textContent=m.players?.name||"Unknown";$("objectName").textContent=m.object_name;$("roomName").textContent=m.room_name}
 const completed=!!m?.completed;const ghost=p?.status==="ghost";
 $("missionStatusBadge").textContent=completed?"COMPLETE":ghost?"GHOST":"ACTIVE";
 $("missionHint").textContent=completed?"Your mission is complete.":ghost?"You are a ghost, but your mission is still active.":"Keep this screen private.";
 $("missionCompleteBtn").classList.toggle("hidden",!m||completed);
 const b=$("statusBoard");b.innerHTML="";(board||[]).forEach(x=>{const li=document.createElement("li"),n=document.createElement("span"),s=document.createElement("small");n.className="name";n.textContent=x.name;s.textContent=x.mission_completed?"✅ Mission complete":x.status==="ghost"?"👻 Ghost":"🟢 Alive";li.append(n,s);b.append(li)});
 const f=$("eventFeed");f.innerHTML="";(events||[]).forEach(x=>{const li=document.createElement("li");li.textContent=x.message;const t=document.createElement("time");t.textContent=new Date(x.created_at).toLocaleString();li.append(t);f.append(li)});
}

async function completeMission(){
 if(!confirm("Confirm that you completed your mission?"))return;
 try{
  const {data:m,error:me}=await sb.from("missions").select("id,target_player_id,completed").eq("player_id",session.playerId).maybeSingle();if(me)throw me;if(!m||m.completed)throw Error("Mission is already complete");
  const {data:k,error:ke}=await sb.from("players").select("name,status").eq("id",session.playerId).single();if(ke)throw ke;
  const {data:t,error:te}=await sb.from("players").select("name,status").eq("id",m.target_player_id).single();if(te)throw te;
  await sb.from("missions").update({completed:true,completed_at:new Date().toISOString()}).eq("id",m.id);
  await sb.from("players").update({mission_completed:true}).eq("id",session.playerId);
  if(t.status!=="ghost")await sb.from("players").update({status:"ghost",alive:false}).eq("id",m.target_player_id);
  await sb.from("game_events").insert([
   {game_id:session.gameId,event_type:"complete",message:`${k.name} completed their mission.`},
   {game_id:session.gameId,event_type:"elimination",message:`${t.name} was eliminated and is now a Ghost.`}
  ]);
  msg("Mission recorded.");loadGame();
 }catch(e){msg(e.message,true)}
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
 document.querySelectorAll("[data-home]").forEach(button=>{
  button.onclick=event=>{
   event.preventDefault();
   showView("homeView");
  };
 });

 ["hostPin","playerPin","loginPin"].forEach(id=>{
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
  sb.from("games")
   .select("status")
   .eq("id",session.gameId)
   .maybeSingle()
   .then(({data,error})=>{
    if(error){
     clear();
     showView("homeView");
     return;
    }
    data?.status==="waiting"?openLobby():openGame();
   });
 }
}
addEventListener("DOMContentLoaded",init);
})();
