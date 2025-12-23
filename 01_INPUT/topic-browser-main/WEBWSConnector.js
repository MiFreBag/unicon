
export default class WEBWSConnector {
  wss;
  jobId = 0;
  tasks = {};
  eventBus ={};

  constructor() {
    observable(this.eventBus);
  }

  getEventBus(){
    return this.eventBus;
  }

  sendRequest(method, parameter, refId, cb) {
    let jobId = this.jobId++;

    let query = {
      method: method,
      parameter: parameter,
      id: jobId,
    };
    if (cb) {
      this.tasks[jobId] = cb;
    }
    this.wss.send(JSON.stringify(query));
    console.log("ws send query:",query)

    return jobId;
  }

  clearTaskJob(jobId) {
    delete this.tasks[jobId];
  }

  async connect() {

    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const wstarget = urlParams.get('target') || window.location.hostname+":30089";
    console.log("wstarget:",wstarget, "hostname:", window.location.hostname);

    //const ws = await connectToServer();
    const ws = new WebSocket("ws://" + wstarget + "/ws");
    //const ws = new WebSocket("ws://10.100.55.102:7071/ws");
    this.wss = ws;

    ws.addEventListener("open", (event) => {
      console.log("ws got event open");
      this.eventBus.trigger("wsconnected");
    });

    ws.addEventListener("error", (event) => {
      console.log("ws got event error");
      this.eventBus.trigger("wsdisconnected");
    });

    ws.addEventListener("close", (event) => {
      console.log("ws got event close");
      this.eventBus.trigger("wsdisconnected");
    });


    this.wss.onmessage = (message) => {
      let data = JSON.parse(message.data);
      console.log("ws message received", data);
      let cb = this.tasks[data.id];
      if(cb){ //task may be already unsubscribed
        cb(data.id, data.result);
      }
    };

    this.wss.onclose = (e) => {
      console.log(
        "Socket is closed. Reconnect will be attempted in 1 second.",
        e.reason
      );
      setTimeout(() => {
        this.connect();
      }, 1000);
    };

    this.wss.onerror = (err) => {
      console.error(
        "Socket encountered error: ",
        err.message,
        "Closing socket"
      );
      this.wss.close();
    };


    return new Promise((resolve, reject) => {
      const timer = setInterval(() => {
        if (ws.readyState === 1) {
          clearInterval(timer);
          resolve(ws);
        }
        else{
          //clearInterval(timer);
          //ws = new WebSocket("ws://10.100.55.101:7071/ws");
        }
      }, 100);
    });

  }
}
