(()=>{'use strict';

const rules=window.JACKSPEAK_MANUAL_RULES||{};
const index=window.JACKSPEAK_SOURCE_INDEX||[];
const concepts=window.JACKSPEAK_CONCEPTS||[];
const autoConcepts=window.JACKSPEAK_AUTO_CONCEPTS||[];
const $=id=>document.getElementById(id);
const input=$('input'),output=$('output'),status=$('status'),suggestions=$('suggestions');


const conceptRenderers={
  immersion_accidental:(g,raw)=>immersionSentence(g.subject,false,punctuationOf(raw)),
  immersion_deliberate:(g,raw)=>immersionSentence(g.subject,true,punctuationOf(raw)),
  deep_six_object:(g,raw)=>`${subjectLead(g.subject)} deep-sixed the ${navalObject(g.item)} in the oggin${punctuationOf(raw)}`,
  bumph_adrift:(g,raw)=>`The bumph's all adrift${punctuationOf(raw)}`,
  up_to_eyes_bumph:(g,raw)=>`${subjectLead(g.subject)} ${beVerb(g.subject)} up to ${possessive(g.subject)} eyes in bumph${punctuationOf(raw)}`,
  subject_adrift:(g,raw)=>`${contractSubject(g.subject)} adrift${punctuationOf(raw)}`,
  ball_bagged:(g,raw)=>`${fatigueSubject(g.subject)} ball-bagged${punctuationOf(raw)}`,
  scran_reheat:(g,raw)=>`This scran's got some serious reheat${punctuationOf(raw)}`,
  blower_bent:(g,raw)=>`The blower's bent${punctuationOf(raw)}`,
  bin_it:(g,raw)=>`Bin it${punctuationOf(raw)}`,
  aye_aye:(g,raw)=>`Aye aye${punctuationOf(raw)}`,
  brass_monkeys:(g,raw)=>`It's brass monkeys${punctuationOf(raw)}`,
  bad_scran:(g,raw)=>`This scran's proper gash${punctuationOf(raw)}`,
  bog_off:(g,raw)=>`Bog off${punctuationOf(raw)}`
};


function autoTokens(text){
  const stop=new Set(['this','that','the','and','but','with','from','into','onto','over','under','have','has','had','was','were','are','is','am','being','been','very','really','just','some','then','than','they','them','their','there','here','your','you','our','ours','his','her','she','him','who','what','when','where','which','would','could','should']);
  return (String(text).toLowerCase().match(/[a-z][a-z'-]{2,}/g)||[])
    .map(w=>w.replace(/'s$/,'').replace(/ies$/,'y').replace(/s$/,''))
    .filter(w=>!stop.has(w));
}
function phraseRegex(phrase){
  const escaped=phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+');
  return new RegExp(`\\b${escaped}\\b`,'i');
}
function applyAutomatedConceptLayer(text,mode,matches){
  const threshold=mode==='safe'?4:mode==='balanced'?3:2;
  let result=text;
  const protectedTerms=new Set();

  // High-confidence reverse-definition phrase mappings.
  for(const rec of autoConcepts){
    if(rec.q<threshold||!rec.p||!rec.p.length)continue;
    for(const phrase of rec.p.sort((a,b)=>b.length-a.length)){
      const rx=phraseRegex(phrase);
      if(rx.test(result)){
        result=result.replace(rx,matched=>{
          protectedTerms.add(rec.t.toLowerCase());
          matches.push({layer:'automated concept',name:rec.t});
          return preserveCase(matched,rec.t);
        });
        break;
      }
    }
  }

  // Semantic fallback: one cautious replacement per sentence, only with strong overlap.
  result=splitSentences(result).map(sentence=>{
    const toks=new Set(autoTokens(sentence));
    if(toks.size<2)return sentence;
    let best=null,bestScore=0;
    for(const rec of autoConcepts){
      if(rec.q<threshold||protectedTerms.has(rec.t.toLowerCase()))continue;
      let overlap=0;
      for(const k of rec.k||[])if(toks.has(k))overlap++;
      if(overlap<2)continue;
      const score=overlap*2 + rec.q + Math.min((rec.p||[]).length,2);
      if(score>bestScore){best=rec;bestScore=score;}
    }
    const needed=mode==='adventurous'?7:9;
    if(!best||bestScore<needed)return sentence;

    // Replace the longest matching cue, rather than appending unexplained slang.
    const cues=[...(best.p||[]),...(best.k||[])].sort((a,b)=>b.length-a.length);
    for(const cue of cues){
      const rx=phraseRegex(cue);
      if(rx.test(sentence)){
        matches.push({layer:'automated semantic',name:best.t});
        return sentence.replace(rx,m=>preserveCase(m,best.t));
      }
    }
    return sentence;
  }).join('');

  return result;
}

function punctuationOf(text){
  const m=String(text).trim().match(/[.!?]+$/);
  return m?m[0]:'.';
}
function subjectLead(s){
  const map={i:'I',he:'He',she:'She',we:'We',they:'They',you:'You'};
  return map[String(s||'i').toLowerCase()]||titleCase(String(s||'I'));
}
function navalObject(item){
  const v=String(item||'kit').toLowerCase();
  if(['phone','mobile','telephone'].includes(v))return 'blower';
  if(v==='radio')return 'wireless';
  return v;
}
function beVerb(s){return ['i'].includes(String(s).toLowerCase())?'am':['he','she'].includes(String(s).toLowerCase())?'is':'are';}
function possessive(s){
  const map={i:'my',he:'his',she:'her',we:'our',they:'their',you:'your'};
  return map[String(s||'we').toLowerCase()]||'our';
}
function contractSubject(s){
  const map={i:"I'm",we:"We're",they:"They're",you:"You're",he:"He's",she:"She's",'the team':'The team are','the project':"The project's",'the job':"The job's"};
  return map[String(s||'we').toLowerCase()]||subjectLead(s);
}
function fatigueSubject(s){
  const key=String(s||'everyone').toLowerCase();
  if(key==='i')return "I'm";
  if(key==='we')return "We're";
  if(key==='they')return "They're";
  if(key==='he')return "He's";
  if(key==='she')return "She's";
  return "The ship's company are";
}
function namedGroups(match){return match&&match.groups?match.groups:{};}
function compileConceptPattern(source){return new RegExp(`^\\s*(?:${source})\\s*[.!?]*\\s*$`,'i');}
function conceptThreshold(mode){return mode==='safe'?5:mode==='balanced'?4:3;}
function applyConceptEngine(sentence,mode,matches){
  const threshold=conceptThreshold(mode);
  const trimmed=sentence.trim();
  if(!trimmed)return sentence;
  for(const concept of concepts){
    if((concept.confidence||3)<threshold)continue;
    for(const source of concept.patterns||[]){
      const match=trimmed.match(compileConceptPattern(source));
      if(!match)continue;
      const renderer=conceptRenderers[concept.render];
      if(!renderer)continue;
      matches.push({layer:'concept/event',name:concept.id});
      const leading=sentence.match(/^\s*/)?.[0]||'';
      const trailing=sentence.match(/\s*$/)?.[0]||'';
      return leading+renderer(namedGroups(match),trimmed)+trailing;
    }
  }
  return sentence;
}

const synonymMap={
  phone:['telephone','mobile','blower'],
  tired:['exhausted','fatigued','weary','shattered'],
  exhausted:['tired','fatigued','sleep','shattered'],
  late:['delayed','overdue','schedule','behind'],
  confused:['muddle','disorganised','bewildered','chaotic'],
  broken:['faulty','damaged','failure','not working'],
  party:['celebration','outing','beano'],
  food:['meal','ration','cook','dish','curry','scran'],
  curry:['food','meal','dish','spicy'],
  hot:['spicy','heated','dangerous','popular'],
  friend:['mate','companion','oppo'],
  angry:['furious','annoyed','livid'],
  drunk:['intoxicated','alcohol','drink'],
  money:['cash','pay','currency'],
  boss:['officer','commander','captain'],
  work:['job','task','duty'],
  toilet:['lavatory','heads'],
  bed:['sleep','bunk','pit'],
  boat:['ship','vessel'],
  ship:['vessel','boat'],
  quickly:['speed','fast','urgent'],
  excellent:['best','first-rate','superb'],
  mess:['chaos','muddle','disorganised','adrift']
};

const sentenceTemplates=[

  {
    name:'fell overboard into sea',
    level:1,
    pattern:/^\s*(?:(i|he|she|we|they|you|[A-Z][A-Za-z'-]*)\s+)?(?:accidentally\s+)?(?:fell|tumbled|slipped|went|was knocked|got knocked)\s+(?:overboard|over the side)(?:\s+(?:and|then))?(?:\s+(?:fell|landed|went|dropped|splashed))?(?:\s+(?:into|in))?(?:\s+the)?\s*(?:water|sea|ocean|oggin)?\s*([.!?]*)\s*$/i,
    replace:m=>immersionSentence(m[1],false,m[2])
  },
  {
    name:'fell into sea',
    level:1,
    pattern:/^\s*(?:(i|he|she|we|they|you|[A-Z][A-Za-z'-]*)\s+)?(?:accidentally\s+)?(?:fell|tumbled|slipped|went|was knocked|got knocked)\s+(?:into|in)\s+(?:the\s+)?(?:water|sea|ocean|oggin)\s*([.!?]*)\s*$/i,
    replace:m=>immersionSentence(m[1],false,m[2])
  },
  {
    name:'jumped overboard',
    level:2,
    pattern:/^\s*(?:(i|he|she|we|they|you|[A-Z][A-Za-z'-]*)\s+)?(?:deliberately\s+|intentionally\s+)?(?:jumped|dived|leapt|hopped)\s+(?:overboard|over the side|into\s+(?:the\s+)?(?:water|sea|ocean|oggin))\s*([.!?]*)\s*$/i,
    replace:m=>immersionSentence(m[1],true,m[2])
  },
  {
    name:'person overboard',
    level:1,
    pattern:/^\s*(?:a\s+)?(?:man|person|sailor|crew member|rating)\s+(?:has\s+|had\s+)?(?:fallen|fell|gone|went)\s+overboard\s*([.!?]*)\s*$/i,
    replace:m=>`Someone's float-tested themselves and hit the oggin${m[1]||'.'}`
  },
  {
    name:'hot food',
    level:1,
    pattern:/^\s*(this|that|the)\s+(curry|food|meal|dish|chilli|stew|sauce)\s+(?:is|'s)\s+(?:very\s+|really\s+|extremely\s+)?(hot|spicy)\s*([.!?]*)\s*$/i,
    replace:m=>`${titleCase(m[1])} scran's got ${/very|really|extremely/i.test(m[0])?'some serious':'a fair bit of'} reheat${m[4]||'.'}`
  },
  {
    name:'food tastes hot',
    level:1,
    pattern:/^\s*(this|that|the)\s+(curry|food|meal|dish|chilli|stew|sauce)\s+(?:tastes|feels)\s+(?:very\s+|really\s+|extremely\s+)?(hot|spicy)\s*([.!?]*)\s*$/i,
    replace:m=>`${titleCase(m[1])} scran's got ${/very|really|extremely/i.test(m[0])?'some serious':'a fair bit of'} reheat${m[4]||'.'}`
  },
  {
    name:'paperwork mess',
    level:1,
    pattern:/^\s*(?:the|this|that|our|my)?\s*(paperwork|documents|forms|admin)\s+(?:is|'s|are)\s+(?:a\s+)?(?:complete\s+|total\s+|real\s+)?(mess|muddle|disorganised|chaos)\s*([.!?]*)\s*$/i,
    replace:m=>`The bumph's ${/complete|total/i.test(m[0])?'all ':''}adrift${m[3]||'.'}`
  },
  {
    name:'behind schedule',
    level:1,
    pattern:/^\s*(we|they|you|the team|the project|the job)\s+(?:are|'re|is|'s)\s+(?:badly\s+|well\s+)?(behind schedule|running late|delayed|overdue)\s*([.!?]*)\s*$/i,
    replace:m=>`${subjectPronoun(m[1])} adrift${m[3]||'.'}`
  },
  {
    name:'everyone exhausted',
    level:2,
    pattern:/^\s*(everyone|everybody|the crew|the team|we|they)\s+(?:is|are|'s|'re)\s+(?:completely\s+|totally\s+|utterly\s+|very\s+)?(exhausted|shattered|worn out|knackered|fatigued)\s*([.!?]*)\s*$/i,
    replace:m=>`${crewSubject(m[1])} ball-bagged${m[3]||'.'}`
  },
  {
    name:'phone broken',
    level:1,
    pattern:/^\s*(?:the|this|that|my|your|our)?\s*(phone|telephone|mobile)\s+(?:is|'s)\s+(broken|faulty|not working|dead)\s*([.!?]*)\s*$/i,
    replace:m=>`The blower's bent${m[3]||'.'}`
  },
  {
    name:'understood order',
    level:1,
    pattern:/^\s*(?:yes[, ]+)?(?:i\s+)?(?:understand|understood|will do|shall do|consider it done)(?:[,; ]+(?:and\s+)?(?:i\s+)?(?:will do|shall do|understand|understood))?\s*([.!?]*)\s*$/i,
    replace:m=>`Aye aye${m[1]||'.'}`
  },
  {
    name:'cancel it',
    level:2,
    pattern:/^\s*(?:cancel|scrap|abandon|drop)\s+(?:the\s+)?(?:plan|project|job|idea|meeting|operation|it)\s*([.!?]*)\s*$/i,
    replace:m=>`Bin it${m[1]||'.'}`
  },
  {
    name:'go away',
    level:2,
    pattern:/^\s*(?:please\s+)?(?:go away|clear off|leave me alone|get lost)\s*([.!?]*)\s*$/i,
    replace:m=>`Bog off${m[1]||'.'}`
  }
];

const contextSenses=[

  {
    name:'sea-water',
    target:/\b(?:the\s+)?(?:water|sea|ocean)\b/i,
    context:['overboard','over the side','fell','fallen','jumped','dived','swam','swim','ship','boat','deck','shore','waves'],
    replacement:'the oggin',
    level:1
  },
  {
    name:'drinking-water',
    target:/\b(?:some\s+|a\s+glass\s+of\s+|a\s+bottle\s+of\s+)?water\b/i,
    context:['drink','drinking','thirsty','glass','bottle','fresh','tap','hydration'],
    replacement:"Adam's ale",
    level:1
  },
  {
    name:'hot-food',
    target:/\b(?:very\s+|really\s+|extremely\s+)?(?:hot|spicy)\b/i,
    context:['curry','food','meal','dish','chilli','stew','sauce','scran','eat','taste'],
    replacement:'full-on reheat',
    level:1
  },
  {
    name:'hot-machinery',
    target:/\b(?:very\s+|really\s+|extremely\s+)?hot\b/i,
    context:['engine','motor','boiler','machinery','bearing','generator','pump'],
    replacement:'running hot',
    level:1
  },
  {
    name:'hot-danger',
    target:/\b(?:very\s+|really\s+|extremely\s+)?hot\b/i,
    context:['area','zone','situation','contact','target','fire','combat','dangerous'],
    replacement:'properly kinetic',
    level:2
  },
  {
    name:'cold-weather',
    target:/\b(?:very\s+|really\s+|extremely\s+)?cold\b/i,
    context:['weather','day','night','outside','wind','sea','room'],
    replacement:'brass monkeys',
    level:2
  },
  {
    name:'mess-state',
    target:/\b(?:a\s+)?(?:complete\s+|total\s+|real\s+)?mess\b/i,
    context:['paperwork','documents','forms','admin','plan','schedule','organisation','office'],
    replacement:'all adrift',
    level:1
  }
];

const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function pattern(term){
  const e=esc(term).replace(/\s+/g,'\\s+');
  return new RegExp((/^\w/.test(term)?'\\b':'')+e+(/\w$/.test(term)?'\\b':''),'gi');
}
function titleCase(s){return s.charAt(0).toUpperCase()+s.slice(1).toLowerCase()}

function immersionSentence(subject,deliberate,punctuation){
  const stop=punctuation||'.';
  if(!subject){
    return deliberate
      ? `Went for an unscheduled dip in the oggin${stop}`
      : `Float-tested myself and hit the oggin${stop}`;
  }

  const lower=subject.toLowerCase();
  const forms={
    i:{lead:'I',reflexive:'myself'},
    he:{lead:'He',reflexive:'himself'},
    she:{lead:'She',reflexive:'herself'},
    we:{lead:'We',reflexive:'ourselves'},
    they:{lead:'They',reflexive:'themselves'},
    you:{lead:'You',reflexive:'yourself'}
  };
  const form=forms[lower]||{lead:titleCase(subject),reflexive:'themselves'};

  if(deliberate){
    return `${form.lead} went for an unscheduled dip in the oggin${stop}`;
  }
  return `${form.lead} float-tested ${form.reflexive} and hit the oggin${stop}`;
}
function subjectPronoun(s){
  s=s.toLowerCase();
  if(s==='we')return "We're";
  if(s==='they')return "They're";
  if(s==='you')return "You're";
  if(s==='the team')return "The team are";
  if(s==='the project')return "The project's";
  if(s==='the job')return "The job's";
  return titleCase(s);
}
function crewSubject(s){
  s=s.toLowerCase();
  if(s==='we')return "We're";
  if(s==='they')return "They're";
  return "The ship's company are";
}
function preserveCase(src,out){
  if(src===src.toUpperCase()&&/[A-Z]/.test(src))return out.toUpperCase();
  if(src[0]===src[0].toUpperCase())return out[0].toUpperCase()+out.slice(1);
  return out;
}
function protect(store,value){
  const token=`\uE000${store.length}\uE001`;
  store.push(value);
  return token;
}
function applyRules(text,terms,replacement,store,matches,layer){
  for(const term of [...terms].sort((a,b)=>b.length-a.length)){
    text=text.replace(pattern(term),match=>{
      matches.push({layer,name:replacement});
      return protect(store,preserveCase(match,replacement));
    });
  }
  return text;
}
function splitSentences(text){
  return text.match(/[^.!?\n]+[.!?]*|\n+/g)||[text];
}
function applySentenceTemplate(sentence,level,matches){
  const trimmed=sentence.trim();
  if(!trimmed)return sentence;
  for(const template of sentenceTemplates){
    if(template.level>level)continue;
    const match=trimmed.match(template.pattern);
    if(match){
      matches.push({layer:'sentence template',name:template.name});
      const leading=sentence.match(/^\s*/)?.[0]||'';
      const trailing=sentence.match(/\s*$/)?.[0]||'';
      return leading+template.replace(match)+trailing;
    }
  }
  return sentence;
}
function contextScore(text,words){
  const lower=text.toLowerCase();
  return words.reduce((score,word)=>score+(new RegExp(`\\b${esc(word)}\\b`,'i').test(lower)?1:0),0);
}
function applyContextMeanings(text,level,store,matches){
  for(const sense of contextSenses){
    if(sense.level>level||!sense.target.test(text))continue;
    const score=contextScore(text,sense.context);
    if(score<1)continue;
    text=text.replace(sense.target,match=>{
      matches.push({layer:'meaning',name:sense.name});
      return protect(store,preserveCase(match,sense.replacement));
    });
  }
  return text;
}
function translate(){
  const raw=input.value.trim();
  if(!raw){
    status.textContent='Enter some plain English first, shipmate.';
    input.focus();
    return;
  }
  const level=+$('strength').value;
  const rewriteMode=$('rewriteMode').value;
  const store=[],matches=[];

  let text=splitSentences(raw).map(sentence=>applyConceptEngine(sentence,rewriteMode,matches)).join('');

  text=applyAutomatedConceptLayer(text,mode,matches);
  text=splitSentences(text).map(sentence=>applySentenceTemplate(sentence,level,matches)).join('');

  text=applyContextMeanings(text,level,store,matches);

  (rules.phraseRules||[]).filter(r=>r.level<=level)
    .forEach(r=>text=applyRules(text,r.terms,r.out,store,matches,'exact phrase'));

  (rules.semanticConcepts||[]).filter(r=>r.level<=level)
    .forEach(r=>text=applyRules(text,r.groups.flat(),r.out,store,matches,'synonym/context'));

  (rules.dictionaryRules||[]).filter(r=>r.level<=level)
    .forEach(r=>text=applyRules(text,r.terms,r.out,store,matches,'dictionary'));

  text=text.replace(/\uE000(\d+)\uE001/g,(_,n)=>store[+n]);

  if(level===3){
    if(!/^(right then|stand by|now then)/i.test(text))text='Right then, '+text;
    if(!/[.!?]$/.test(text))text+='.';
    text+=' Carry on, shipmate.';
  }

  output.textContent=text;
  renderSuggestions(raw);

  const counts={};
  matches.forEach(m=>counts[m.layer]=(counts[m.layer]||0)+1);
  const summary=Object.entries(counts).map(([k,v])=>`${v} ${k}`).join(', ');
  status.textContent=matches.length
    ? `Applied ${summary}.`
    : rewriteMode==='safe'
      ? 'No high-confidence rewrite found. Try Balanced or Adventurous mode.'
      : 'No confident translation found; source suggestions are shown below.';
}
function tokenize(source){
  const words=(source.toLowerCase().match(/[a-z][a-z'-]{2,}/g)||[])
    .map(w=>w.replace(/'s$/,'').replace(/s$/,''));
  const result=new Set(words);
  words.forEach(w=>(synonymMap[w]||[]).forEach(x=>result.add(x)));
  return result;
}
function renderSuggestions(source){
  const tokens=tokenize(source);
  const branch=$('branch').value;
  const strong=$('strongLanguage').checked;
  const ranked=[];

  for(const entry of index){
    if(!strong&&entry.s)continue;
    if(branch!=='ALL'&&branch!=='RN'&&entry.b.length&&!entry.b.includes(branch))continue;
    let score=0,hits=0;
    for(const keyword of entry.k){
      if(tokens.has(keyword)){score+=keyword.length>7?3:2;hits++}
      else{
        for(const token of tokens){
          if(token.length>5&&(keyword.startsWith(token)||token.startsWith(keyword))){
            score+=1;hits++;break;
          }
        }
      }
    }
    if(hits)ranked.push([score+Math.min(hits,3),entry]);
  }
  ranked.sort((a,b)=>b[0]-a[0]||a[1].t.localeCompare(b[1].t));

  suggestions.innerHTML='';
  const used=new Set();
  for(const [,entry] of ranked){
    if(used.has(entry.t.toLowerCase()))continue;
    used.add(entry.t.toLowerCase());
    const chip=document.createElement('span');
    chip.className='chip';
    chip.textContent=entry.t;
    if(entry.b.length){
      const small=document.createElement('small');
      small.textContent=' '+entry.b.join('/');
      chip.appendChild(small);
    }
    suggestions.appendChild(chip);
    if(used.size>=12)break;
  }
  if(!used.size)suggestions.innerHTML='<span class="empty">No close source match found.</span>';
}

$('translate').addEventListener('click',translate);
$('clear').addEventListener('click',()=>{
  input.value='';
  output.textContent='Your translation will appear here.';
  suggestions.innerHTML='<span class="empty">No suggestions yet.</span>';
  status.textContent='';
  input.focus();
});
$('copy').addEventListener('click',async()=>{
  try{
    await navigator.clipboard.writeText(output.textContent);
    status.textContent='Copied.';
  }catch(error){
    const range=document.createRange();
    range.selectNodeContents(output);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    status.textContent='Selected—tap Copy in the iPhone menu.';
  }
});
input.addEventListener('keydown',event=>{
  if((event.metaKey||event.ctrlKey)&&event.key==='Enter')translate();
});

})();