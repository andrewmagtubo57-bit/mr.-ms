// ===== startup check: shows a red message if a required file did not load =====
(function(){
 var miss = [];
 if(typeof firebase === 'undefined') miss.push('Firebase SDK (check your internet or ad blocker)');
 else if(typeof auth === 'undefined' || typeof db === 'undefined') miss.push('firebase-config.js');
 if(typeof DATA === 'undefined' || typeof CAT === 'undefined' || typeof DEADLINE === 'undefined') miss.push('data.js');
 if(!miss.length) return;
 var d = document.createElement('div');
 d.setAttribute('role','alert');
 d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:100;background:#e02424;color:#fff;padding:12px 16px;font:600 15px/1.4 sans-serif;text-align:center';
 d.textContent = 'This page could not start. Not loaded: ' + miss.join(', ') + '. Keep every file in the same folder and open the page through Live Server or your hosting URL.';
 document.body.insertBefore(d, document.body.firstChild);
 throw new Error('Missing: ' + miss.join(', '));
})();

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
// real photo if data.js has a "photo" path, otherwise the colored placeholder
function photo(c, i, k){ return c.photo || placeholder(c, i, k); }
// if a photo file is missing or the path is wrong, fall back to the placeholder
function imgFail(img, k, i){ img.onerror = null; img.src = placeholder(DATA[k][i], i, k); }

function placeholder(c, i, k){
 var ini = c.name.split(' ').map(function(w){return w[0];}).join('');
 var h = k==='mr' ? [200,210,195,220][i] : [355,5,348,12][i];
 var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl('+h+',72%,54%)"/><stop offset="1" stop-color="hsl('+(h+14)+',68%,34%)"/></linearGradient></defs><rect width="300" height="420" fill="url(#a)"/><circle cx="150" cy="150" r="56" fill="rgba(255,255,255,.16)"/><path d="M50 330c10-70 55-100 100-100s90 30 100 100z" fill="rgba(255,255,255,.16)"/><text x="150" y="172" text-anchor="middle" font-family="Georgia,serif" font-size="54" fill="#ffffff">'+ini+'</text><text x="150" y="60" text-anchor="middle" font-family="Georgia,serif" font-size="22" fill="rgba(255,255,255,.7)">No. '+(i+1)+'</text></svg>';
 return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// ===== deadline =====
function isClosed(){ return !votingOn || (DEADLINE && Date.now() >= DEADLINE.getTime()); }

function tickDeadline(){
 var el = $('dl'), ms = DEADLINE ? DEADLINE - Date.now() : Infinity;
 if(!votingOn || ms <= 0){
  el.className = 'dl closed';
  el.innerHTML = 'Voting has closed. Thank you for taking part.';
  return;
 }
 if(ms === Infinity){ el.className = 'dl'; el.innerHTML = 'Voting is open. No deadline has been set.'; return; }
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
   DEADLINE = (d.deadline && d.deadline.toDate) ? d.deadline.toDate() : null;
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

// birthday can't be in the future
function todayStr(){ var d = new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
$('f-bday').max = todayStr();

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

function readProfile(){
 var u = $('f-user').value.trim(), mob = $('f-mobile').value, g = $('f-gender').value, ad = $('f-address').value.trim();
 var sid = $('f-sid').value.trim(), bd = $('f-bday').value, yr = $('f-year').value, sec = $('f-section').value.trim();
 if(u.length < 3) fail('Username must be at least 3 characters.');
 if(!/^[A-Za-z0-9-]{3,20}$/.test(sid)) fail('Student ID must be 3-20 letters, numbers, or dashes.');
 if(!/^[0-9]{11}$/.test(mob)) fail('Mobile number must be exactly 11 digits.');
 if(!g) fail('Select your gender.');
 if(!bd || bd > todayStr() || bd < '1950-01-01') fail('Enter a valid birthday.');
 if(ad.length < 5) fail('Enter your full address.');
 if(!yr) fail('Select your year level.');
 if(!sec) fail('Enter your section.');
 return { username:u, studentId:sid, mobile:mob, gender:g, birthday:bd, address:ad, course:$('f-course').value, year:yr, section:sec };
}

var registering = false;   // true while a new account is being created

$('authForm').addEventListener('submit', async function(e){
 e.preventDefault();
 var btn = $('authBtn');
 $('authErr').textContent = ''; $('authOk').textContent = '';
 btn.disabled = true;
 try{
  var ts = firebase.firestore.FieldValue.serverTimestamp();
  if(authMode === 'complete'){
   // logged in but has no profile document yet
   var cu = auth.currentUser; if(!cu) fail('Please log in again.');
   var cp = readProfile(); cp.email = cu.email; cp.createdAt = ts;
   await db.doc('users/'+cu.uid).set(cp);
  }else{
   var email = $('f-email').value.trim(), pass = $('f-pass').value;
   if(!email) fail('Enter your email.');
   if(!pass) fail('Enter your password.');
   if(authMode === 'register'){
    var p = readProfile();
    if(!updateRules()) fail('Your password does not meet all the requirements.');
    registering = true;
    var cred = await auth.createUserWithEmailAndPassword(email, pass);
    try{
     p.email = email; p.createdAt = ts;
     await db.doc('users/'+cred.user.uid).set(p);
    }catch(werr){
     logErr('profile save')(werr);
     try{ await cred.user.delete(); }catch(x){}      // don't leave an account without a profile
     fail('Could not save your profile. Make sure the latest Firestore rules are published, then try again.');
    }
   }else{
    await auth.signInWithEmailAndPassword(email, pass);
   }
  }
 }catch(err){
  console.error('[auth]', err.code||'', err.message||err);
  $('authErr').textContent = err.msg || authMsg(err);
 }
 registering = false;
 btn.disabled = false;
});

// ----- "Complete your profile" screen for accounts that have no profile data -----
function showComplete(user){
 if(registering) return;
 authMode = 'complete';
 $('authScreen').hidden = false;
 $('authTabs').hidden = true;
 $('f-email').parentNode.hidden = true;
 $('f-pass').closest('.fld').hidden = true;
 $('regFields').hidden = false; $('regPass').hidden = true; $('forgotRow').hidden = true;
 $('completeRow').hidden = false;
 $('authTitle').textContent = 'Complete your profile';
 $('authSub').textContent = 'Your account has no profile details yet. Fill them in to continue.';
 $('authBtn').textContent = 'Save profile';
 $('authErr').textContent = ''; $('authOk').textContent = '';
 if(!$('f-user').value) $('f-user').value = (user.email || '').split('@')[0];
}
function hideComplete(){
 if(authMode !== 'complete') return;
 $('authTabs').hidden = false;
 $('f-email').parentNode.hidden = false;
 $('f-pass').closest('.fld').hidden = false;
 $('completeRow').hidden = true;
 $('authTitle').innerHTML = 'Mr. &amp; Ms. CICS';
 $('authSub').textContent = 'Log in to cast your vote.';
 setAuthMode('login');
 $('authScreen').hidden = true;
}
$('completeOut').addEventListener('click', function(){ auth.signOut(); });

auth.onAuthStateChanged(function(user){
 unsubs.forEach(function(u){ u(); }); unsubs = [];
 if(!user){
  profile = null; mine = {mr:null, ms:null}; votes = {mr:[0,0,0,0], ms:[0,0,0,0]};
  hideComplete();
  $('authScreen').hidden = false; $('pop').hidden = true; $('adminLink').hidden = true;
  render(); return;
 }
 $('authScreen').hidden = true;
 startListeners(user);
});

function startListeners(user){
 db.doc('admins/'+user.uid).get().then(function(s){ $('adminLink').hidden = !s.exists; }).catch(function(){});
 unsubs.push(db.doc('users/'+user.uid).onSnapshot(function(s){
  profile = s.exists ? s.data() : null; renderProfile(user);
  if(s.exists) hideComplete();
  else if(!s.metadata.fromCache) showComplete(user);
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
 $('pf-sid').textContent = p.studentId || '';
 $('pf-mobile').textContent = p.mobile || '';
 $('pf-bday').textContent = p.birthday || '';
 $('pf-year').textContent = (p.year || '') + (p.section ? ' · ' + p.section : '');
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

 var main = '<article class="main"><div class="ph"><img src="'+photo(c,i,k)+'" alt="Portrait of '+c.name+'" onerror="imgFail(this,\''+k+'\','+i+')"><div class="cap"><b>No. '+(i+1)+'</b><span>'+CAT[k]+' candidate</span></div></div>'+
  '<div class="info"><h3>'+c.name+'<span class="badge">'+c.year+'</span></h3><p class="motto">“'+c.motto+'”</p>'+
  '<div class="tbl">'+rows.map(function(r){return '<div><span>'+r[0]+'</span><span>'+r[1]+'</span></div>';}).join('')+'</div>'+
  '<div class="bar"><i style="width:'+p+'%"></i></div><div class="row"><b>'+p+'%</b><span>'+v+' vote'+(v===1?'':'s')+'</span></div>'+
  '<button class="vote'+(mine[k]===i?' mine':'')+'" id="vb"'+(isClosed()||mine[k]===i?' disabled':'')+'>'+(isClosed()?'Voting closed':label)+'</button></div></article>';

 var strip = '<div class="strip">'+DATA[k].map(function(x,j){
  if(j===i) return '';
  return '<button class="mini" data-s="'+j+'" aria-label="View '+x.name+'"><img src="'+photo(x,j,k)+'" alt="" onerror="imgFail(this,\''+k+'\','+j+')"><span class="cap"><b>'+x.name.split(' ')[0]+'</b>No. '+(j+1)+' · '+(mine[k]===j?'Your vote ✓':pct(k,j)+'%')+'</span></button>';
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
