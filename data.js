// data.js: shared by voting.html and admin.html. EDIT contender names/details here.
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

