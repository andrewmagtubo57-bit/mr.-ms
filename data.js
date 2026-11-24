// data.js: shared by voting.html and admin.html. EDIT contender names/details here.
// data.js: deadline, categories, contender info. EDIT THIS to change names/details.
var DEADLINE = new Date('2026-12-05T17:00:00+08:00'); // fallback only; Firestore settings/voting.deadline overrides it
var CAT = { mr: 'Mr. CICS', ms: 'Ms. CICS' };
var DATA = {
 mr: [
  {photo:'marco.jpg',name:'Marco Villanueva',course:'BS Computer Science',year:'3rd Year',age:21,height:"5'10\"",motto:'Code with courage, lead with kindness.',adv:'Free coding bootcamps for public schools',talent:'Acoustic guitar'},
  {photo:'josh.png',name:'Josh Cabahug',course:'BS Information Technology',year:'4th Year',age:22,height:"5'9\"",motto:'Every bug is a lesson in disguise.',adv:'Digital literacy for senior citizens',talent:'Street dance'},
  {photo:'rafael.png',name:'Rafael Tan',course:'B Library and Information Science',year:'2nd Year',age:20,height:"5'11\"",motto:'Be the change the system needs.',adv:'Mental health awareness on campus',talent:'Spoken word poetry'},
  {photo:'kent.png',name:'Kent Alcantara',course:'BS Computer Science',year:'4th Year',age:22,height:"5'8\"",motto:'Small steps compile into big dreams.',adv:'Open-source learning communities',talent:'Beatboxing'}
 ],
 ms: [
  {photo:'isabelle.jpg',name:'Isabelle Reyes',course:'BS Information Technology',year:'3rd Year',age:20,height:"5'6\"",motto:'Grace is my algorithm.',adv:'Women in tech scholarships',talent:'Classical singing'},
  {photo:'chloe.jpg',name:'Chloe Mendoza',course:'BS Computer Science',year:'4th Year',age:21,height:"5'5\"",motto:'Dream in code, shine in color.',adv:'Safe and inclusive online spaces',talent:'Contemporary dance'},
  {photo:'bianca.jpg',name:'Bianca Lim',course:'B Library and Information Science',year:'2nd Year',age:19,height:"5'7\"",motto:'Brains and beauty, powered by heart.',adv:'Zero-waste campus initiatives',talent:'Digital painting'},
  {photo:'trisha.jpg',name:'Trisha Gonzales',course:'BS Information Technology',year:'3rd Year',age:21,height:"5'4\"",motto:'Rise, debug, repeat.',adv:'Free tutoring for freshmen',talent:'Piano'}
 ]
};

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
