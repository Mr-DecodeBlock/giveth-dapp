import React, { Fragment, useContext, useRef } from 'react';
import PropTypes from 'prop-types';

import Trace from 'models/Trace';
import TraceService from 'services/TraceService';
import ErrorPopup from 'components/ErrorPopup';
import ConversationModal from 'components/ConversationModal';
import { authenticateUser, checkBalance } from 'lib/middleware';
import { Context as Web3Context } from '../contextProviders/Web3Provider';
import { Context as UserContext } from '../contextProviders/UserProvider';
import BridgedTrace from '../models/BridgedTrace';
import LPPCappedTrace from '../models/LPPCappedTrace';
import LPTrace from '../models/LPTrace';
import { sendAnalyticsTracking } from '../lib/SegmentAnalytics';
import { txNotification } from '../lib/helpers';
import ErrorHandler from '../lib/ErrorHandler';

const ApproveRejectTraceCompletionButtons = ({ trace }) => {
  const {
    state: { currentUser },
  } = useContext(UserContext);
  const {
    state: { isForeignNetwork, balance, web3 },
    actions: { displayForeignNetRequiredWarning },
  } = useContext(Web3Context);

  const conversationModal = useRef();

  const approveTraceCompleted = async () => {
    authenticateUser(currentUser, false, web3).then(authenticated => {
      if (!authenticated) return;
      checkBalance(balance)
        .then(() => {
          conversationModal.current
            .openModal({
              title: 'Approve Trace completion',
              description:
                'Optionally explain why you approve the completion of this Trace. Compliments are appreciated! This information will be publicly visible and emailed to the Trace owner.',
              textPlaceholder: 'Optionally explain why you approve the completion of this Trace...',
              required: false,
              cta: 'Approve completion',
              enableAttachProof: false,
            })
            .then(proof => {
              TraceService.approveTraceCompletion({
                trace,
                from: currentUser.address,
                proof,
                onTxHash: txUrl => {
                  sendAnalyticsTracking('Approved Trace', {
                    category: 'Trace',
                    action: 'approved',
                    traceId: trace._id,
                    title: trace.title,
                    slug: trace.slug,
                    traceOwnerAddress: trace.ownerAddress,
                    traceType: trace.formType,
                    traceRecipientAddress: trace.recipientAddress,
                    parentCampaignId: trace.campaign._id,
                    parentCampaignAddress: trace.campaign.ownerAddress,
                    parentCampaignTitle: trace.campaign.title,
                    reviewerAddress: trace.reviewerAddress,
                    userAddress: currentUser.address,
                    txUrl,
                  });

                  txNotification('Approving this Trace is pending...', txUrl, true);
                },
                onConfirmation: txUrl => txNotification('The Trace has been approved!', txUrl),
                onError: (err, txUrl) => {
                  if (err === 'patch-error') {
                    ErrorPopup("Something went wrong with approving this Trace's completion", err);
                  } else {
                    ErrorPopup(
                      'Something went wrong with the transaction.',
                      `${txUrl} => ${JSON.stringify(err, null, 2)}`,
                    );
                  }
                },
                web3,
              });
            })
            .catch(_ => {});
        })
        .catch(err => ErrorHandler(err, 'Something went wrong on getting user balance.'));
    });
  };

  const rejectTraceCompleted = async () => {
    authenticateUser(currentUser, false, web3).then(authenticated => {
      if (!authenticated) return;
      checkBalance(balance)
        .then(() => {
          conversationModal.current
            .openModal({
              title: 'Reject Trace completion',
              description:
                'Explain why you rejected the completion of this Trace. This information will be publicly visible and emailed to the Trace owner.',
              textPlaceholder: 'Explain why you rejected the completion of this Trace...',
              required: true,
              cta: 'Reject completion',
              enableAttachProof: false,
            })
            .then(proof => {
              TraceService.rejectTraceCompletion({
                trace,
                from: currentUser.address,
                proof,
                onTxHash: txUrl => {
                  sendAnalyticsTracking('Trace Rejected', {
                    category: 'Trace',
                    action: 'rejected completion',
                    traceId: trace._id,
                    title: trace.title,
                    ownerId: trace.ownerAddress,
                    traceType: trace.formType,
                    traceRecipientAddress: trace.recipientAddress,
                    parentCampaignId: trace.campaign.id,
                    reviewerAddress: trace.reviewerAddress,
                    txUrl,
                    userAddress: currentUser.address,
                  });

                  txNotification(
                    'Rejecting this Trace&apos;s completion is pending...',
                    txUrl,
                    true,
                  );
                },
                onConfirmation: txUrl =>
                  txNotification('The Trace&apos;s completion has been rejected.', txUrl),
                onError: (err, txUrl) => {
                  if (err === 'patch-error') {
                    ErrorPopup("Something went wrong with rejecting this Trace's completion", err);
                  } else {
                    ErrorPopup(
                      'Something went wrong with the transaction.',
                      `${txUrl} => ${JSON.stringify(err, null, 2)}`,
                    );
                  }
                },
                web3,
              });
            })
            .catch(_ => {});
        })
        .catch(err => ErrorHandler(err, 'Something went wrong on getting user balance.'));
    });
  };

  return (
    <Fragment>
      {trace.canUserApproveRejectCompletion(currentUser) && (
        <span>
          <button
            type="button"
            className="btn btn-success btn-sm"
            onClick={() =>
              isForeignNetwork ? approveTraceCompleted() : displayForeignNetRequiredWarning()
            }
          >
            <i className="fa fa-thumbs-up" />
            &nbsp;Approve
          </button>

          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() =>
              isForeignNetwork ? rejectTraceCompleted() : displayForeignNetRequiredWarning()
            }
          >
            <i className="fa fa-thumbs-down" />
            &nbsp;Reject Completion
          </button>
        </span>
      )}

      <ConversationModal ref={conversationModal} />
    </Fragment>
  );
};

ApproveRejectTraceCompletionButtons.propTypes = {
  trace: PropTypes.oneOfType(
    [Trace, BridgedTrace, LPPCappedTrace, LPTrace].map(PropTypes.instanceOf),
  ).isRequired,
};

export default React.memo(ApproveRejectTraceCompletionButtons);
