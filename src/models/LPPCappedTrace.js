/* eslint-disable class-methods-use-this */
import { LPPCappedMilestone as LPPCappedMilestoneContract } from '@giveth/lpp-capped-milestone';
import Trace from './Trace';

/**
 * The DApp LPPCappedTrace model
 */
export default class LPPCappedTrace extends Trace {
  constructor(data) {
    super(data);

    const {
      campaignReviewerAddress = '',

      // transient
      campaignReviewer,
    } = data;

    // transient
    this._campaignReviewer = campaignReviewer;
    this._campaignReviewerAddress = campaignReviewerAddress;
  }

  toFeathers(txHash) {
    return {
      ...super.toFeathers(txHash),
      campaignReviewerAddress: this._campaignReviewerAddress,
    };
  }

  contract(web3) {
    if (!web3) throw new Error('web3 instance is required');
    return new LPPCappedMilestoneContract(web3, this.pluginAddress);
  }

  /**
    get & setters
  * */
  get traceType() {
    return 'LPPCappedMilestone';
  }

  set campaignReviewerAddress(value) {
    this.checkType(value, ['string'], 'campaignReviewerAddress');
    this._campaignReviewerAddress = value;
  }

  get campaignReviewerAddress() {
    return this._campaignReviewerAddress;
  }

  get campaignReviewer() {
    return this._campaignReviewer;
  }

  // computed properties

  get hasReviewer() {
    return true;
  }

  // while this is possible on the contract, this is a
  // 2 step process and we don't support this in the ui
  // b/c this contract is deprecated
  canUserChangeRecipient() {
    return false;
  }
}
