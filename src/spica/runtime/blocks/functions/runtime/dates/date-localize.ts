import { defineRuntimeBlock } from '../../../../adapter';
import { boundedText, configKeys } from '../../../../support';

export default defineRuntimeBlock({
  id:'spica.runtime.date_localize',version:'1',kind:'pure',trust:'built-in',category:'functions',
  description:'Format an explicit ISO date or timestamp in a chosen locale and timezone. Invalid dates fail visibly.',
  exampleConfig:{locale:'en-GB',timeZone:'UTC',style:'medium'},
  configSchema:{type:'object',properties:{locale:{type:'string'},timeZone:{type:'string'},style:{type:'string',enum:['short','medium','long']}},
    additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:'value',type:{kind:'string'},required:true}],outputs:[{id:'text',type:{kind:'string'}}],
  validateConfig(config){
    configKeys(config,'locale','timeZone','style');
    if(config.locale!==undefined)boundedText(config.locale,'locale',60);
    if(config.timeZone!==undefined)boundedText(config.timeZone,'timeZone',100);
    if(config.style!==undefined&&!['short','medium','long'].includes(String(config.style)))throw Error('Unsupported date style.');
    new Intl.DateTimeFormat(String(config.locale??'en-GB'),{timeZone:String(config.timeZone??'UTC')});
  },
  execute(_ctx,inputs,config){
    const text=String(inputs.value);
    if(!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:[\d.]+(?:Z|[+-]\d{2}:\d{2}))?$/.test(text))throw Error('Use an ISO date or timestamp with an explicit timezone.');
    const [year,month,day]=text.slice(0,10).split('-').map(Number) as [number,number,number];
    const leap=year%4===0&&(year%100!==0||year%400===0);
    const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
    if(month<1||month>12||day<1||day>days[month-1]!)throw Error('Invalid calendar date.');
    const date=new Date(text);
    if(!Number.isFinite(date.getTime())||(text.length===10&&date.toISOString().slice(0,10)!==text))throw Error('Invalid calendar date.');
    return {text:new Intl.DateTimeFormat(String(config.locale??'en-GB'),{timeZone:String(config.timeZone??'UTC'),
      dateStyle:(config.style??'medium') as 'medium'}).format(date)};
  },
});
