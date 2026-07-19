(()=>{'use strict';

const rules=window.JACKSPEAK_MANUAL_RULES||{};
const index=window.JACKSPEAK_SOURCE_INDEX||[];
const $=id=>document.getElementById(id);
const input=$('input'),output=$('output'),status=$('status'),suggestions=$('suggestions');

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
  const store=[],matches=[];

  let text=splitSentences(raw).map(sentence=>applySentenceTemplate(sentence,level,matches)).join('');

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