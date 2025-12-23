export default class TopicTopDown {
  topics = []; //[topic]
  topicList = []; // [{text; pre,sel,post}]
  topicListFiltered = []; // [{text; pre;sel;post}]
  topicListDisplayed = [];
  show = false;
  selIdx = 0;
  filterText = "";
  onClickCb = undefined;
  _showAll = true;


  setFilter(filterText) {
    if (this.filterText != filterText) {
      if(this.topics.length > 0) this.show = true;
      this.selIdx = -1;
      this.filterText = filterText;
      this.buildTopicList(this.topics);
      this.buildFilteredList();
      this.activateList();
    }
  }

  set showAll(showall) {
    this._showAll = showall;
    if(this.topics.length > 0) this.show = true;
    this.buildFilteredList();
    this.activateList();
  }

  setChildTopics(topics) {
    if (this.topics != topics) {
      this.show = this.topics.length >= 0? true: false;
      this.selIdx = -1;
      this.topics = topics.sort((a, b) => a - b);
      this.buildTopicList(topics);
      this.buildFilteredList();
      this.activateList();
    }
  }

  selectPrevious() {
    this.selIdx = this.selIdx >= 0 ? this.selIdx - 1 : this.selIdx;
    this.show = true;
  }

  selectNext() {
    if(this.topics.length>0){  
        this.selIdx =
        this.selIdx < this.topicListDisplayed.length - 1
            ? this.selIdx + 1
            : this.selIdx;
        this.show = true;
    }

  }

  getSelectedTopic() {
    if (this.selIdx >= 0) {
      return this.topicListDisplayed[this.selIdx]?.text;
    }
    return null;
  }

  buildTopicList(topics) {
    this.topics = topics;

    this.topicList = topics.map((topic) => {
      const idx = topic.indexOf(this.filterText);
      if (idx >= 0 && this.filterText.length > 0) {
        return {
          text: topic,
          pretext: topic.slice(0, idx),
          seltext: this.filterText,
          posttext: topic.slice(idx + this.filterText.length),
        };
      } else {
        return { text: topic, pretext: topic, seltext: "", posttext: "" };
      }
    });
  }

  buildFilteredList() {
    this.topicListFiltered = this.topicList.filter(
      (el) => el.seltext.length > 0 || this.filterText.length === 0
    );
    if (this.topicListFiltered.length === 1) {
      //singleMatch -> autoselect element
      this.selIdx = 0;
    }
  }

  activateList() {
    this.topicListDisplayed = this._showAll
      ? [
          ...this.topicList,
          { text: "*", pretext: "*", seltext: "", posttext: "" },
        ]
      : [...this.topicListFiltered];

    // this.topicListDisplayed.push({text: '*', pretext: '*', seltext: "", posttext: ""});
    //this.topicListDisplayed.push({text: '#', pretext: '#', seltext: "", posttext: ""});
    //autselect

    //direct match
    const matchIdx = this.topicListDisplayed.findIndex(
      (el) => el.text === this.filterText
    );
    if (matchIdx >= 0) {
      this.selIdx = matchIdx;
    } else if (this.topics.length > 0 && this.topicListDisplayed.length === 1) {
      //singleMatch -> autoselect element
      this.selIdx = 0;
    } else if (this.topics.length > 0 && this.topicListFiltered.length === 1) {
      //singleMatch -> autoselect element
      const text = this.topicListFiltered[0].text;
      this.selIdx = this.topicListDisplayed.findIndex((el) => el.text === text);
    }
  }

  onClick(e) {
    if (this.onClickCb) {
      const topic =
        this.topicListDisplayed[e.currentTarget.getAttribute("data-idx")].text;
      this.onClickCb(topic);
    }
  }
}
