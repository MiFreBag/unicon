export default class SmartUpdate {
  constructor(
    updatefunc,
    maxBurstDelay_ms = 10,
    maxDelay_ms = 100,
    allowFirstThru = false
  ) {
    this.updatefunc = updatefunc;
    this.maxDelay_ms = maxDelay_ms;
    this.maxBurstDelay_ms = maxBurstDelay_ms;
    this.maxDelayTimeout = undefined;
    this.burstDelayTimeout = undefined;
    this.allowFirstThru = allowFirstThru;
    this._lastUpdateCall = performance.now();
  }

  update() {
    var time = performance.now();

    var isBurst = time - this._lastUpdateCall < this.maxBurstDelay_ms;

    this._lastUpdateCall = time;

    if (isBurst) {
      if (this.maxDelayTimeout == undefined) {
        //begin of burst

        this.maxDelayTimeout = setTimeout(
          function () {
            this._doUpdate();
          }.bind(this),
          this.maxDelay_ms
        );
      }

      this.restartBurstTimer();
    } else {
      //first after some time (>maxBurstDelay_ms)

      if (this.allowFirstThru) {
        this._doUpdate();
      } else {
        this.restartBurstTimer();
      }
    }
  }

  restartBurstTimer() {
    if (this.burstDelayTimeout != undefined) {
      //in use
      clearTimeout(this.burstDelayTimeout);
    }

    this.burstDelayTimeout = setTimeout(
      function () {
        this._doUpdate();
      }.bind(this),
      this.maxBurstDelay_ms
    );
  }

  forceUpdate() {
    _doUpdate();
  }

  pseudoUpdate() {
    if (this.maxDelayTimeout != undefined) {
      clearTimeout(this.maxDelayTimeout);

      this.maxDelayTimeout = undefined;
    }
  }

  _doUpdate() {
    if (this.maxDelayTimeout != undefined) {
      clearTimeout(this.maxDelayTimeout);

      this.maxDelayTimeout = undefined;
    }

    if (this.burstDelayTimeout != undefined) {
      clearTimeout(this.burstDelayTimeout);

      this.burstDelayTimeout = undefined;
    }

    this.updatefunc();
  }
}
