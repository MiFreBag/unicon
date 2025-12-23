export default class Subscriptions {
  //subs = new Map(); // key=jobId, value={cbs: Array{cb}, topicData : {topic, data}
  subs = new Map(); // key=jobId, value={cbs: Array{cb}, topicData : [{topic:string, data:string}]
  allTopicsSorted = [];
  allData = {};
  allViewMetaData = {};
  wsconn;
  onAnyDataCb;
  pageIdx = 0;
  maxPerPage = 14;
  

  constructor(wsconn){
    this.wsconn = wsconn;
  }
  

  addSubscription(filter, subsconfig, onTopicDataCb){
    
    let jobId = null;
    
    if(filter){
      jobId = this._subscribe(filter, subsconfig);
      this.subs.set(jobId, {topicData : {}, cb:onTopicDataCb});
    }
  
    return jobId;
  }


  removeSubscription(jobId){
    
    this.subs.delete(jobId);
    this._unsubscribe(jobId);
  }

  removeAllSubscription(jobId){
      this.subs.forEach((data, jobId, map) => {
      this.removeSubscription(jobId);
      this.allData = {};
      this.allTopicsSorted = [];

    });
  }


  _subscribe(filter, subsconfig){
   
    return this.wsconn.sendRequest('subscribe', {filter: filter, subsconfig: subsconfig}, 0, this.onJobData.bind(this));
  }

  
  _unsubscribe(jobId){
    this.wsconn.sendRequest('unsubscribe', {jobId: jobId}, 0, null);
    this.wsconn.clearTaskJob(jobId);
  }

  getTopicPaged(pageIdx){
    let startIdx = pageIdx * this.maxPerPage;
    return this.allTopicsSorted.slice(startIdx, startIdx + this.maxPerPage);
  }

  getTopicData(topic){
    return this.allData[topic];
  }


  onJobData(jobId, result){


    let jobDef = this.subs.get(jobId);
    let idx = this.allTopicsSorted.findIndex( (topic) => topic ===result.topic);
    if(idx < 0){
      this.allTopicsSorted.push(result.topic);
      this.allTopicsSorted.sort((a,b) =>  a.length - b.length ||  a.localeCompare(b));
    }
    
    this.allData[result.topic] = result.data;
    this.allViewMetaData[result.topic] = {stablesec : 0};

    // this.subs.get(jobId).topicData[result.topic] = result.data;
    // this.subs.get(jobId).cbList.forEach(cb => cb(result.topic, result.data));

    //handle empty payload => topic decommissioning / delte
    if(result.data === null || result.data ==='' || result.data ==='null'){
      console.log("decommissioned, removed topic=", result.topic);
      this.allTopicsSorted.splice(this.allTopicsSorted.indexOf(result.topic),1);
      delete this.allData[result.topic];
    }


    if(jobDef.cb){
      jobDef.cb(result.data);
    }
    this.onAnyDataCb();
  }


  tick(){
    let minTick = 1000;
    let obj = this.allViewMetaData;
    for (var property in obj) {
      if (obj.hasOwnProperty(property)) {

          let tick = obj[property].stablesec++;
          if(tick < minTick){
            minTick = tick;
          }
      }
    }
    return minTick
  }


}
