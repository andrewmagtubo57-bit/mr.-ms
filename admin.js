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

// ===== helpers =====
var F = firebase.firestore.FieldValue;
var CATS = ['mr','ms'];

function $(id){ return document.getElementById(id); }
function esc(s){
 return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
 });
}
function logErr(w){ return function(e){ console.error('['+w+']', e.code||'', e.message||e); }; }
function showToast(msg){
 var t = $('toast'); t.textContent = msg; t.hidden = false;
 clearTimeout(showToast.h); showToast.h = setTimeout(function(){ t.hidden = true; }, 2800);
}
function pad(n){ return String(n).padStart(2,'0'); }
function toLocalInput(d){
 return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
}

// confirm dialog (optional typed word for dangerous actions)
function confirmBox(title, msg, word){
 return new Promise(function(resolve){
  var d = $('dlg'), inp = $('dlgIn'), ok = $('dlgOk');
  $('dlgT').textContent = title; $('dlgM').textContent = msg;
  inp.value = ''; inp.hidden = !word; inp.placeholder = word ? 'Type '+word+' to confirm' : '';
  ok.disabled = !!word;
  inp.oninput = function(){ ok.disabled = inp.value.trim() !== word; };
  ok.onclick = function(){ resolve(true); d.close(); };
  $('dlgNo').onclick = function(){ d.close(); };
  d.onclose = function(){ resolve(false); };   // ignored if already resolved true
  d.showModal();
 });
}

// ===== state =====
var settings = { open:true, deadline:null, exists:false };
var tallies  = { mr:[0,0,0,0], ms:[0,0,0,0] };
var ballots  = { mr:{}, ms:{} };     // uid -> candidate index
var users    = [];
var unsubs   = [];
var q = '', courseF = null, shown = 50;

// ===== sign in gate =====
document.addEventListener('click', function(e){
 var b = e.target.closest('[data-eye]'); if(!b) return;
 var inp = $(b.dataset.eye), show = inp.type === 'password';
 inp.type = show ? 'text' : 'password';
 b.textContent = show ? 'Hide' : 'Show';
 b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
 b.setAttribute('aria-pressed', String(show));
});

$('gateForm').addEventListener('submit', async function(e){
 e.preventDefault();
 $('gateErr').textContent = ''; $('gateBtn').disabled = true;
 try{
  await auth.signInWithEmailAndPassword($('g-email').value.trim(), $('g-pass').value);
 }catch(err){
  logErr('login')(err);
  $('gateErr').textContent = (err.code === 'auth/too-many-requests') ? 'Too many attempts. Wait a minute.' : 'Wrong email or password.';
 }
 $('gateBtn').disabled = false;
});
$('logout').addEventListener('click', function(){ auth.signOut(); });
$('deniedOut').addEventListener('click', function(){ auth.signOut(); });

auth.onAuthStateChanged(async function(user){
 unsubs.forEach(function(u){ u(); }); unsubs = [];
 $('app').hidden = true;
 if(!user){
  $('gate').hidden = false; $('gateForm').hidden = false; $('denied').hidden = true; return;
 }
 var ok = false;
 try{ ok = (await db.doc('admins/'+user.uid).get()).exists; }catch(e){ logErr('admin check')(e); }
 if(!ok){
  $('gate').hidden = false; $('gateForm').hidden = true; $('denied').hidden = false;
  $('deniedWho').textContent = user.email || 'This account'; return;
 }
 $('gate').hidden = true; $('app').hidden = false;
 $('adminWho').textContent = 'Signed in as ' + (user.email || '');
 startListeners();
});

function startListeners(){
 unsubs.push(db.doc('settings/voting').onSnapshot(function(s){
  var d = s.exists ? s.data() : {};
  settings = { exists:s.exists, open: d.open !== false, deadline: (d.deadline && d.deadline.toDate) ? d.deadline.toDate() : null };
  renderControl();
 }, logErr('settings')));

 CATS.forEach(function(k){
  unsubs.push(db.doc('tallies/'+k).onSnapshot(function(s){
   var d = s.exists ? s.data() : {};
   tallies[k] = [d.c0||0, d.c1||0, d.c2||0, d.c3||0];
   renderStats(); renderChart(k);
  }, logErr('tally '+k)));
  unsubs.push(db.collection('ballots/'+k+'/users').onSnapshot(function(sn){
   var m = {}; sn.forEach(function(doc){ m[doc.id] = doc.data().candidate; });
   ballots[k] = m; renderStats(); renderUsers();
  }, logErr('ballots '+k)));
 });

 unsubs.push(db.collection('users').orderBy('createdAt','desc').onSnapshot(function(sn){
  users = sn.docs.map(function(d){ var x = d.data(); x.id = d.id; return x; });
  renderStats(); renderUsers();
 }, logErr('users')));
}

// ===== voting control =====
function renderControl(){
 var passed = settings.deadline && Date.now() >= settings.deadline.getTime();
 var st = $('status');
 st.textContent = !settings.open ? 'CLOSED' : (passed ? 'CLOSED · deadline passed' : 'OPEN');
 st.className = 'pill ' + ((!settings.open || passed) ? 'closed' : 'open');
 $('toggleBtn').textContent = settings.open ? 'Turn voting OFF' : 'Turn voting ON';
 $('dlText').textContent = settings.deadline
  ? 'Closes ' + settings.deadline.toLocaleString([], {dateStyle:'medium', timeStyle:'short'}) + (passed ? ' (already passed)' : '')
  : 'No deadline set.';
 if(document.activeElement !== $('dlInput')) $('dlInput').value = settings.deadline ? toLocalInput(settings.deadline) : '';
 $('setupNote').hidden = settings.exists;
}

// always writes "open" too, because the security rules need it
function writeSettings(patch){
 return db.doc('settings/voting').set(Object.assign({open: settings.open}, patch), {merge:true});
}

$('toggleBtn').addEventListener('click', async function(){
 try{ await writeSettings({open: !settings.open}); showToast(settings.open ? 'Voting is now OFF' : 'Voting is now ON'); }
 catch(e){ logErr('toggle')(e); showToast('Could not change voting status.'); }
});

$('saveDl').addEventListener('click', async function(){
 var v = $('dlInput').value, d = v ? new Date(v) : null;
 if(!d || isNaN(d.getTime())){ showToast('Pick a date and time first.'); return; }
 try{ await writeSettings({deadline: firebase.firestore.Timestamp.fromDate(d)}); showToast('Deadline saved'); }
 catch(e){ logErr('deadline')(e); showToast('Could not save the deadline.'); }
});

$('rmDl').addEventListener('click', async function(){
 try{ await writeSettings({deadline: F.delete()}); showToast('Deadline removed'); }
 catch(e){ logErr('remove deadline')(e); showToast('Could not remove the deadline.'); }
});

$('resetBtn').addEventListener('click', async function(){
 var ok = await confirmBox('Reset all votes', 'This deletes every ballot and sets all counts to 0. Students can vote again. This cannot be undone.', 'RESET');
 if(!ok) return;
 try{
  for(var c = 0; c < CATS.length; c++){
   var docs = (await db.collection('ballots/'+CATS[c]+'/users').get()).docs;
   for(var i = 0; i < docs.length; i += 400){
    var b = db.batch();
    docs.slice(i, i+400).forEach(function(d){ b.delete(d.ref); });
    await b.commit();
   }
  }
  var b2 = db.batch();
  CATS.forEach(function(k){ b2.set(db.doc('tallies/'+k), {c0:0,c1:0,c2:0,c3:0}); });
  await b2.commit();
  showToast('All votes were reset');
 }catch(e){ logErr('reset')(e); showToast('Reset failed. Check the console.'); }
});

// ===== stats =====
function leader(k){
 var t = tallies[k], sum = t.reduce(function(a,b){return a+b;},0), mx = Math.max.apply(null, t);
 if(!sum) return '—';
 var winners = t.filter(function(x){ return x === mx; }).length;
 return winners > 1 ? 'Tie' : DATA[k][t.indexOf(mx)].name;
}
function renderStats(){
 var cast = 0; CATS.forEach(function(k){ cast += tallies[k].reduce(function(a,b){return a+b;},0); });
 var voters = {}; CATS.forEach(function(k){ Object.keys(ballots[k]).forEach(function(id){ voters[id] = 1; }); });
 var nv = Object.keys(voters).length, reg = users.length;
 var cards = [
  ['Registered users', reg],
  ['Students who voted', nv],
  ['Votes cast', cast],
  ['Participation', reg ? Math.round(nv/reg*100) + '%' : '0%'],
  ['Leading Mr. CICS', leader('mr')],
  ['Leading Ms. CICS', leader('ms')]
 ];
 $('stats').innerHTML = cards.map(function(c){ return '<div class="stat"><small>'+c[0]+'</small><b>'+esc(c[1])+'</b></div>'; }).join('');
}

// ===== charts =====
function renderChart(k){
 var t = tallies[k], sum = t.reduce(function(a,b){return a+b;},0), mx = Math.max.apply(null, t.concat([1]));
 $('chart-'+k).innerHTML = DATA[k].map(function(x,j){
  var p = sum ? Math.round(t[j]/sum*100) : 0;
  return '<div class="col"><div class="n">'+t[j]+'</div><div class="p">'+p+'%</div><div class="trk"><i style="height:'+(t[j]/mx*100)+'%"></i></div><div class="lb">'+esc(x.name.split(' ')[0])+'</div></div>';
 }).join('');
}

// ===== users =====
function voteName(k, uid){ var c = ballots[k][uid]; return c === undefined ? '' : DATA[k][c].name; }
function joined(u){ return (u.createdAt && u.createdAt.toDate) ? u.createdAt.toDate().toLocaleDateString() : ''; }
function chip(val, label, n){
 return '<button class="chip" data-course="'+esc(val)+'" aria-pressed="'+(courseF === (val === '' ? null : val))+'">'+esc(label)+' <b>'+n+'</b></button>';
}

function renderUsers(){
 var counts = {};
 users.forEach(function(u){ var c = u.course || '—'; counts[c] = (counts[c]||0) + 1; });
 $('chips').innerHTML = chip('', 'All', users.length) + Object.keys(counts).map(function(c){ return chip(c, c, counts[c]); }).join('');

 var list = users.filter(function(u){
  if(courseF !== null && (u.course || '—') !== courseF) return false;
  if(!q) return true;
  return [u.username,u.email,u.mobile,u.address,u.course,u.gender].join(' ').toLowerCase().indexOf(q) !== -1;
 });
 var part = list.slice(0, shown);
 $('rows').innerHTML = part.length ? part.map(function(u){
  var mr = voteName('mr',u.id), ms = voteName('ms',u.id);
  var clear = (mr || ms) ? '<button class="btn danger sm" data-clear="'+esc(u.id)+'" type="button">Clear votes</button>' : '';
  return '<tr><td>'+esc(u.username)+'</td><td>'+esc(u.email)+'</td><td>'+esc(u.mobile)+'</td><td>'+esc(u.gender)+'</td><td>'+esc(u.address)+'</td><td>'+esc(u.course)+'</td>'+
   '<td class="'+(mr?'v':'none')+'">'+(mr?esc(mr):'—')+'</td><td class="'+(ms?'v':'none')+'">'+(ms?esc(ms):'—')+'</td><td>'+esc(joined(u))+'</td><td>'+clear+'</td></tr>';
 }).join('') : '<tr><td colspan="10" class="none">No users match.</td></tr>';
 $('count').textContent = 'Showing ' + part.length + ' of ' + list.length + ' user' + (list.length === 1 ? '' : 's');
 $('moreBtn').hidden = list.length <= shown;
}

$('search').addEventListener('input', function(){ q = this.value.trim().toLowerCase(); shown = 50; renderUsers(); });
$('moreBtn').addEventListener('click', function(){ shown += 50; renderUsers(); });

document.addEventListener('click', async function(e){
 var c = e.target.closest('[data-course]');
 if(c){ courseF = c.dataset.course === '' ? null : c.dataset.course; shown = 50; renderUsers(); return; }
 var b = e.target.closest('[data-clear]');
 if(!b) return;
 var uid = b.dataset.clear;
 var u = users.filter(function(x){ return x.id === uid; })[0] || {};
 var ok = await confirmBox('Clear votes', 'Remove all votes cast by ' + (u.username || 'this user') + '? Counts will go down and they can vote again.');
 if(!ok) return;
 try{
  var batch = db.batch(), any = false;
  CATS.forEach(function(k){
   var cand = ballots[k][uid];
   if(cand === undefined) return;
   any = true;
   batch.delete(db.doc('ballots/'+k+'/users/'+uid));
   var upd = {}; upd['c'+cand] = F.increment(-1);
   batch.update(db.doc('tallies/'+k), upd);
  });
  if(any) await batch.commit();
  showToast('Votes cleared');
 }catch(err){ logErr('clear votes')(err); showToast('Could not clear votes.'); }
});

// ===== export CSV =====
function cell(v, i){
 var s = String(v == null ? '' : v);
 if(i === 2 && /^[0-9]{11}$/.test(s)) return '="' + s + '"';   // keep leading zero in Excel
 if(/^[=+\-@\t\r]/.test(s)) s = "'" + s;                        // block spreadsheet formulas
 return '"' + s.replace(/"/g, '""') + '"';
}
$('csvBtn').addEventListener('click', function(){
 var head = ['Username','Email','Mobile','Gender','Address','Course','Mr. CICS vote','Ms. CICS vote','Joined'];
 var rows = users.map(function(u){ return [u.username,u.email,u.mobile,u.gender,u.address,u.course,voteName('mr',u.id),voteName('ms',u.id),joined(u)]; });
 var csv = [head].concat(rows).map(function(r){ return r.map(cell).join(','); }).join('\r\n');
 var a = document.createElement('a');
 a.href = URL.createObjectURL(new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8'}));
 a.download = 'cics-voters-' + new Date().toISOString().slice(0,10) + '.csv';
 document.body.appendChild(a); a.click(); a.remove();
 setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
});
