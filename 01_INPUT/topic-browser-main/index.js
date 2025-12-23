import WEBWSConnector from "./WEBWSConnector.js";
import Subscriptions from "./Subscriptions.js";
import SmartUpdate from "./SmartUpdate.js";
import mqttMatchFun from "./mqtt-match.js";
import TopicDropDown from "./TopicDropDown.js";

(async function main() {
  let wsconn = new WEBWSConnector();
  let subs = new Subscriptions(wsconn);
  window.mqttMatch = mqttMatchFun;
  window.TopicDropDown = TopicDropDown;

  await riot.compile();
  
  wsconn.connect();

  //await wsconn.connect();
  riot.mount("app", { wsconn: wsconn, subs: subs, smartupdateClass: SmartUpdate});

})();
