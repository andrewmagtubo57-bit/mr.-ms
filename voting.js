// ===== data =====
// data.js: deadline, categories, contender info. EDIT THIS to change names/details.
var DEADLINE = new Date('2026-12-05T17:00:00+08:00'); // fallback only; Firestore settings/voting.deadline overrides it
var CAT = { mr: 'Mr. CICS', ms: 'Ms. CICS' };
var DATA = {
 mr: [
  {name:'Marco Villanueva',course:'BS Computer Science',year:'3rd Year',age:21,height:"5'10\"",motto:'Code with courage, lead with kindness.',adv:'Free coding bootcamps for public schools',talent:'Acoustic guitar'},
  {name:'Josh Cabahug',course:'BS Information Technology',year:'4th Year',age:22,height:"5'9\"",motto:'Every bug is a lesson in disguise.',adv:'Digital literacy for senior citizens',talent:'Street dance'},
  {name:'Rafael Tan',course:'BS Information Systems',year:'2nd Year',age:20,height:"5'11\"",motto:'Be the change the system needs.',adv:'Mental health awareness on campus',talent:'Spoken word poetry'},
  {name:'Kent Alcantara',course:'BS Computer Science',year:'4th Year',age:22,height:"5'8\"",motto:'Small steps compile into big dreams.',adv:'Open-source learning communities',talent:'Beatboxing'}
 ],
 ms: [
  {name:'Isabelle Reyes',course:'BS Information Technology',year:'3rd Year',age:20,height:"5'6\"",motto:'Grace is my algorithm.',adv:'Women in tech scholarships',talent:'Classical singing'},
  {name:'Chloe Mendoza',course:'BS Computer Science',year:'4th Year',age:21,height:"5'5\"",motto:'Dream in code, shine in color.',adv:'Safe and inclusive online spaces',talent:'Contemporary dance'},
  {name:'Bianca Lim',course:'BS Information Systems',year:'2nd Year',age:19,height:"5'7\"",motto:'Brains and beauty, powered by heart.',adv:'Zero-waste campus initiatives',talent:'Digital painting'},
  {name:'Trisha Gonzales',course:'BS Information Technology',year:'3rd Year',age:21,height:"5'4\"",motto:'Rise, debug, repeat.',adv:'Free tutoring for freshmen',talent:'Piano'}
 ]
};

// ===== state =====
var votes = { mr: [0,0,0,0], ms: [0,0,0,0] };  // live counts from Firestore tallies
var mine  = { mr: null, ms: null };            // this user's ballot
var sel   = { mr: 0, ms: 0 };                  // enlarged contender
var tab   = 'mr';
var votingOn = true;                           // settings/voting.open
var profile = null;                            // users/{uid}
var unsubs = [];                               // Firestore listeners

function $(id){ return document.getElementById(id); }
function total(k){ return votes[k].reduce(function(a,b){return a+b;},0); }
function pct(k,i){ var t = total(k); return t ? Math.round(votes[k][i]/t*100) : 0; }
function logErr(where){ return function(e){ console.error('['+where+']', e.code||'', e.message||e); }; }

// ===== photo =====
// photo.js: placeholder portraits. Replace with real image paths later,
// e.g. return 'img/' + k + '-' + (i+1) + '.jpg';
function photo(c, i, k){
 var ini = c.name.split(' ').map(function(w){return w[0];}).join('');
 var h = k==='mr' ? [215,230,200,245][i] : [340,320,355,300][i];
 var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl('+h+',55%,38%)"/><stop offset="1" stop-color="hsl('+(h+40)+',50%,16%)"/></linearGradient></defs><rect width="300" height="420" fill="url(#a)"/><circle cx="150" cy="150" r="56" fill="rgba(255,255,255,.16)"/><path d="M50 330c10-70 55-100 100-100s90 30 100 100z" fill="rgba(255,255,255,.16)"/><text x="150" y="172" text-anchor="middle" font-family="Georgia,serif" font-size="54" fill="#f6dd9f">'+ini+'</text><text x="150" y="60" text-anchor="middle" font-family="Georgia,serif" font-size="22" fill="rgba(255,255,255,.7)">No. '+(i+1)+'</text></svg>';
 return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// ===== deadline =====
function isClosed(){ return !votingOn || Date.now() >= DEADLINE.getTime(); }

function tickDeadline(){
 var el = $('dl'), ms = DEADLINE - Date.now();
 if(!votingOn || ms <= 0){
  el.className = 'dl closed';
  el.innerHTML = 'Voting has closed. Thank you for taking part.';
  return;
 }
 el.className = 'dl';
 var s = Math.floor(ms/1000), d = Math.floor(s/86400), h = Math.floor(s%86400/3600), m = Math.floor(s%3600/60), x = s%60;
 var p = function(n){ return String(n).padStart(2,'0'); };
 el.innerHTML = 'Voting closes ' + DEADLINE.toLocaleString([], {dateStyle:'medium', timeStyle:'short'}) +
  ' <b>' + d + 'd ' + p(h) + 'h ' + p(m) + 'm ' + p(x) + 's</b> left';
}

// live settings (open/closed + deadline) from Firestore
function listenSettings(){
 db.doc('settings/voting').onSnapshot(function(s){
  if(s.exists){
   var d = s.data();
   votingOn = d.open !== false;
   if(d.deadline && d.deadline.toDate) DEADLINE = d.deadline.toDate();
  }
  tickDeadline(); render();
 }, logErr('settings'));
}

// ===== auth (login / register / forgot password / logout) =====
var authMode = 'login';

function authMsg(e){
 var m = {
  'auth/invalid-email':'That email address is not valid.',
  'auth/invalid-credential':'Wrong email or password.',
  'auth/user-not-found':'No account with that email.',
  'auth/wrong-password':'Wrong email or password.',
  'auth/email-already-in-use':'That email is already registered. Try logging in.',
  'auth/weak-password':'Password is too weak.',
  'auth/too-many-requests':'Too many attempts. Wait a minute and try again.',
  'auth/network-request-failed':'No connection. Check your internet.',
  'permission-denied':'Registration was rejected. Check your details.'
 };
 return m[e.code] || 'Something went wrong. Please try again.';
}

function pwChecks(p, c){
 return {
  len: p.length >= 8,
  upper: /[A-Z]/.test(p),
  lower: /[a-z]/.test(p),
  num: /[0-9]/.test(p),
  special: /[^A-Za-z0-9\s]/.test(p),
  match: p.length > 0 && p === c
 };
}
function updateRules(){
 var r = pwChecks($('f-pass').value, $('f-pass2').value), all = true;
 Array.prototype.forEach.call($('pwRules').children, function(li){
  var ok = r[li.dataset.r]; li.classList.toggle('ok', ok); if(!ok) all = false;
 });
 return all;
}
$('f-pass').addEventListener('input', updateRules);
$('f-pass2').addEventListener('input', updateRules);

// mobile: digits only, max 11
$('f-mobile').addEventListener('input', function(){
 this.value = this.value.replace(/\D/g,'').slice(0,11);
});

// show / hide password buttons (login + register)
document.addEventListener('click', function(e){
 var b = e.target.closest('[data-eye]'); if(!b) return;
 var inp = $(b.dataset.eye), show = inp.type === 'password';
 inp.type = show ? 'text' : 'password';
 b.textContent = show ? 'Hide' : 'Show';
 b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
 b.setAttribute('aria-pressed', String(show));
});

function setAuthMode(m){
 authMode = m;
 var reg = m === 'register';
 $('regFields').hidden = !reg;
 $('regPass').hidden = !reg;
 $('forgotRow').hidden = reg;
 $('authBtn').textContent = reg ? 'Create account' : 'Log in';
 $('f-pass').autocomplete = reg ? 'new-password' : 'current-password';
 $('authErr').textContent = ''; $('authOk').textContent = '';
 if(reg) updateRules();
 Array.prototype.forEach.call($('authTabs').children, function(b){ b.setAttribute('aria-selected', String(b.dataset.m === m)); });
}

$('authTabs').addEventListener('click', function(e){
 var b = e.target.closest('[data-m]'); if(b) setAuthMode(b.dataset.m);
});

$('forgotBtn').addEventListener('click', async function(){
 var email = $('f-email').value.trim();
 $('authErr').textContent = ''; $('authOk').textContent = '';
 if(!email){ $('authErr').textContent = 'Type your email above first.'; $('f-email').focus(); return; }
 try{
  await auth.sendPasswordResetEmail(email);
  $('authOk').textContent = 'If that email is registered, a reset link was sent. Check your inbox and spam folder.';
 }catch(err){
  console.error('[auth reset]', err.code||'', err.message||err);
  $('authErr').textContent = authMsg(err);
 }
});

function fail(msg){ throw {code:'x', msg:msg}; }

$('authForm').addEventListener('submit', async function(e){
 e.preventDefault();
 var email = $('f-email').value.trim(), pass = $('f-pass').value, btn = $('authBtn');
 $('authErr').textContent = ''; $('authOk').textContent = '';
 btn.disabled = true;
 try{
  if(!email) fail('Enter your email.');
  if(!pass) fail('Enter your password.');
  if(authMode === 'register'){
   var u = $('f-user').value.trim(), mob = $('f-mobile').value, g = $('f-gender').value, ad = $('f-address').value.trim();
   if(u.length < 3) fail('Username must be at least 3 characters.');
   if(!/^[0-9]{11}$/.test(mob)) fail('Mobile number must be exactly 11 digits.');
   if(!g) fail('Select your gender.');
   if(ad.length < 5) fail('Enter your full address.');
   if(!updateRules()) fail('Your password does not meet all the requirements.');
   var cred = await auth.createUserWithEmailAndPassword(email, pass);
   await db.doc('users/'+cred.user.uid).set({
    username:u, email:email, mobile:mob, gender:g, address:ad, course:$('f-course').value,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
   });
  }else{
   await auth.signInWithEmailAndPassword(email, pass);
  }
 }catch(err){
  console.error('[auth]', err.code||'', err.message||err);
  $('authErr').textContent = err.msg || authMsg(err);
 }
 btn.disabled = false;
});

auth.onAuthStateChanged(function(user){
 unsubs.forEach(function(u){ u(); }); unsubs = [];
 if(!user){
  profile = null; mine = {mr:null, ms:null}; votes = {mr:[0,0,0,0], ms:[0,0,0,0]};
  $('authScreen').hidden = false; $('pop').hidden = true;
  render(); return;
 }
 $('authScreen').hidden = true;
 startListeners(user);
});

function startListeners(user){
 unsubs.push(db.doc('users/'+user.uid).onSnapshot(function(s){
  profile = s.exists ? s.data() : null; renderProfile(user);
 }, logErr('profile')));

 ['mr','ms'].forEach(function(k){
  var tRef = db.doc('tallies/'+k);
  unsubs.push(tRef.onSnapshot(function(s){
   if(!s.exists){ tRef.set({c0:0,c1:0,c2:0,c3:0}).catch(logErr('tally init '+k)); return; }
   var d = s.data(); votes[k] = [d.c0||0, d.c1||0, d.c2||0, d.c3||0]; render();
  }, logErr('tally '+k)));
  unsubs.push(db.doc('ballots/'+k+'/users/'+user.uid).onSnapshot(function(s){
   mine[k] = s.exists ? s.data().candidate : null; render();
  }, logErr('ballot '+k)));
 });
}

// ===== profile (avatar, popup, log out) =====
function renderProfile(user){
 var p = profile || {};
 var name = p.username || (user.email||'').split('@')[0] || 'Student';
 $('avb').textContent = name.charAt(0).toUpperCase();
 $('pf-name').textContent = name;
 $('pf-user').textContent = name;
 $('pf-email').textContent = user.email || '';
 $('pf-mobile').textContent = p.mobile || '';
 $('pf-gender').textContent = p.gender || '';
 $('pf-address').textContent = p.address || '';
 $('pf-course').textContent = p.course || '';
}

document.addEventListener('click', function(e){
 var pop = $('pop');
 if(e.target.closest('#avb')){
  pop.hidden = !pop.hidden;
  $('avb').setAttribute('aria-expanded', String(!pop.hidden));
  return;
 }
 if(e.target.closest('#out')){ pop.hidden = true; auth.signOut(); return; }
 if(!e.target.closest('#pop')) pop.hidden = true;
});

// ===== contenders =====
// contenders.js: category tabs, enlarged card, side strip
function renderTabs(){
 $('tabs').innerHTML = ['mr','ms'].map(function(k){
  return '<button class="tab" role="tab" data-t="'+k+'" aria-selected="'+(k===tab)+'">'+CAT[k]+(mine[k]!==null?'<span class="ck">✓</span>':'')+'</button>';
 }).join('');
}

function renderStage(){
 var k = tab, i = sel[k], c = DATA[k][i], p = pct(k,i), v = votes[k][i], first = c.name.split(' ')[0];
 var label = mine[k]===null ? 'Vote for '+first : (mine[k]===i ? 'You voted for '+first+' ✓' : 'Switch vote to '+first);
 var rows = [['Course', c.course+', '+c.year], ['Age / Height', c.age+' yrs · '+c.height], ['Advocacy', c.adv], ['Talent', c.talent]];

 var main = '<article class="main"><div class="ph"><img src="'+photo(c,i,k)+'" alt="Portrait of '+c.name+'"><div class="cap"><b>No. '+(i+1)+'</b><span>'+CAT[k]+' candidate</span></div></div>'+
  '<div class="info"><h3>'+c.name+'<span class="badge">'+c.year+'</span></h3><p class="motto">“'+c.motto+'”</p>'+
  '<div class="tbl">'+rows.map(function(r){return '<div><span>'+r[0]+'</span><span>'+r[1]+'</span></div>';}).join('')+'</div>'+
  '<div class="bar"><i style="width:'+p+'%"></i></div><div class="row"><b>'+p+'%</b><span>'+v+' vote'+(v===1?'':'s')+'</span></div>'+
  '<button class="vote'+(mine[k]===i?' mine':'')+'" id="vb"'+(isClosed()||mine[k]===i?' disabled':'')+'>'+(isClosed()?'Voting closed':label)+'</button></div></article>';

 var strip = '<div class="strip">'+DATA[k].map(function(x,j){
  if(j===i) return '';
  return '<button class="mini" data-s="'+j+'" aria-label="View '+x.name+'"><img src="'+photo(x,j,k)+'" alt=""><span class="cap"><b>'+x.name.split(' ')[0]+'</b>No. '+(j+1)+' · '+(mine[k]===j?'Your vote ✓':pct(k,j)+'%')+'</span></button>';
 }).join('')+'</div>';

 $('stage').innerHTML = main + strip;
}

document.addEventListener('click', function(e){
 var t = e.target.closest('[data-t]');
 if(t){ tab = t.dataset.t; render(); return; }
 var m = e.target.closest('[data-s]');
 if(m){ sel[tab] = +m.dataset.s; render(); }
});

// ===== chart =====
// chart.js: votes chart for the active category
function renderChart(){
 var k = tab;
 $('ct').textContent = 'Votes chart · ' + CAT[k];
 var mx = Math.max.apply(null, votes[k].concat([1]));
 $('chart').innerHTML = DATA[k].map(function(x,j){
  return '<div class="col'+(mine[k]===j?' me':'')+'"><div class="n">'+votes[k][j]+'</div><div class="p">'+pct(k,j)+'%</div>'+
   '<div class="trk"><i style="height:'+(votes[k][j]/mx*100)+'%"></i></div>'+
   '<div class="lb">'+x.name.split(' ')[0]+(mine[k]===j?' ✓':'')+'</div></div>';
 }).join('');
}

// ===== voting (cast / switch vote, saved to Firestore) =====
function showToast(msg){
 var t = $('toast');
 t.textContent = msg; t.hidden = false;
 clearTimeout(showToast.h);
 showToast.h = setTimeout(function(){ t.hidden = true; }, 2600);
}

async function castVote(){
 var user = auth.currentUser;
 if(!user || isClosed()) return;
 var k = tab, i = sel[k];
 var bRef = db.doc('ballots/'+k+'/users/'+user.uid), tRef = db.doc('tallies/'+k);
 var F = firebase.firestore.FieldValue;
 $('vb').disabled = true;
 try{
  await db.runTransaction(async function(tx){
   var b = await tx.get(bRef);
   var upd = {}; upd['c'+i] = F.increment(1);
   if(b.exists){
    var old = b.data().candidate;
    if(old === i) return;                 // same pick, nothing to do
    upd['c'+old] = F.increment(-1);       // switching: remove old vote
   }
   tx.update(tRef, upd);
   tx.set(bRef, {uid:user.uid, candidate:i, updatedAt:F.serverTimestamp()});
  });
  showToast('Vote recorded for ' + DATA[k][i].name);
 }catch(e){
  console.error('[voting]', e.code||'', e.message||e);
  showToast(e.code === 'permission-denied' ? 'Vote not accepted. Voting may be closed.' : 'Could not save your vote. Try again.');
  render();
 }
}

document.addEventListener('click', function(e){
 if(e.target.closest('#vb')) castVote();
});

// ===== main =====
function render(){
 renderTabs();
 renderStage();
 renderChart();
}

render();
listenSettings();
tickDeadline();
setInterval(tickDeadline, 1000);
