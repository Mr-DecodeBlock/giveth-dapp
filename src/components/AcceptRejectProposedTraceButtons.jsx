import React, { Fragment, useContext, useRef } from 'react';
import PropTypes from 'prop-types';
import { notification } from 'antd';

import TraceService from 'services/TraceService';
import Trace from 'models/Trace';
import { authenticateUser, checkBalance } from 'lib/middleware';
import ConversationModal from 'components/ConversationModal';
import { Context as Web3Context } from '../contextProviders/Web3Provider';
import { Context as UserContext } from '../contextProviders/UserProvider';
import BridgedTrace from '../models/BridgedTrace';
import LPPCappedTrace from '../models/LPPCappedTrace';
import LPTrace from '../models/LPTrace';
import { sendAnalyticsTracking } from '../lib/SegmentAnalytics';
import { txNotification } from '../lib/helpers';
import Campaign from '../models/Campaign';
import ErrorHandler from '../lib/ErrorHandler';

const AcceptRejectProposedTraceButtons = ({ trace }) => {
  const conversationModal = useRef();
  const {
    state: { currentUser },
  } = useContext(UserContext);
  const {
    state: { balance, isForeignNetwork, web3 },
    actions: { displayForeignNetRequiredWarning },
  } = useContext(Web3Context);

  const rejectProposedTrace = async () => {
    authenticateUser(currentUser, false, web3).then(authenticated => {
      if (!authenticated) return;
      conversationModal.current
        .openModal({
          title: 'Reject proposed Trace',
          description:
            'Optionally explain why you reject this proposed Trace. This information will be publicly visible and emailed to the Trace owner.',
          textPlaceholder: 'Optionally explain why you reject this proposal...',
          required: false,
          cta: 'Reject proposal',
          enableAttachProof: false,
        })
        .then(proof => {
          TraceService.rejectProposedTrace({
            trace,
            message: proof.message,
            onSuccess: () => {
              notification.info({
                message: '',
                description: 'The proposed Trace has been rejected.',
              });
              sendAnalyticsTracking('Trace Rejected', {
                category: 'Trace',
                action: 'rejected proposed Trace',
                traceId: trace._id,
                title: trace.title,
                ownerId: trace.ownerAddress,
                traceType: trace.formType,
                traceRecipientAddress: trace.recipientAddress,
                parentCampaignId: trace.campaign._id,
                slug: trace.slug,
                ownerAddress: trace.ownerAddress,
                traceOwnerName: trace.owner.name,
                traceOwnerAddress: trace.ownerAddress,
                parentCampaignTitle: trace.campaign.title,
                parentCampaignAddress: trace.campaign.ownerAddress,
                reviewerAddress: trace.reviewerAddress,
                userAddress: currentUser.address,
              });
            },
            onError: e => ErrorHandler(e, 'Something went wrong with rejecting the proposed Trace'),
          });
        });
    });
  };

  const acceptProposedTrace = async () => {
    authenticateUser(currentUser, false, web3).then(authenticated => {
      if (!authenticated) return;
      checkBalance(balance)
        .then(() =>
          conversationModal.current
            .openModal({
              title: 'Accept proposed Trace',
              description:
                'Your acceptance of this Trace will be recorded as a publicly visible comment, and emailed to the Trace Owner. Please add a personal comment, compliment or other custom message to accompany it!',
              required: false,
              cta: 'Submit',
              enableAttachProof: false,
              type: 'AcceptProposed',
            })
            .then(proof => {
              TraceService.acceptProposedTrace({
                trace,
                from: currentUser.address,
                proof,
                onTxHash: txUrl => {
                  sendAnalyticsTracking('Trace Accepted', {
                    category: 'Trace',
                    action: 'accepted proposed Trace',
                    traceId: trace._id,
                    title: trace.title,
                    slug: trace.slug,
                    ownerAddress: trace.ownerAddress,
                    traceType: trace.formType,
                    traceRecipientAddress: trace.recipientAddress,
                    traceOwnerName: trace.owner.name,
                    traceOwnerAddress: trace.ownerAddress,
                    parentCampaignId: trace.campaign._id,
                    parentCampaignTitle: trace.campaign.title,
                    parentCampaignAddress: trace.campaign.ownerAddress,
                    reviewerAddress: trace.reviewerAddress,
                    userAddress: currentUser.address,
                    txUrl,
                  });
                  txNotification('Accepting this Trace is pending...', txUrl, true);
                },
                onConfirmation: txUrl => txNotification('The Trace has been accepted!', txUrl),
                onError: (err, txUrl) => {
                  if (err === 'patch-error') {
                    ErrorHandler(err, 'Something went wrong with accepting this proposed Trace');
                  } else if (txUrl) {
                    const message = (
                      <Fragment>
                        <p>Something went wrong with the transaction.</p>
                        <a href={txUrl} target="_blank" rel="noopener noreferrer">
                          <p>View Transaction</p>
                        </a>
                        <p>{JSON.stringify(err, null, 2)}</p>
                      </Fragment>
                    );
                    ErrorHandler(err, message);
                  } else ErrorHandler(err);
                },
                web3,
              });
            }),
        )
        .catch(err => ErrorHandler(err, 'Something went wrong on getting user balance.'));
    });
  };

  return (
    <Fragment>
      {trace.canUserAcceptRejectProposal(currentUser) && (
        <span>
          {trace.campaign.status !== Campaign.ARCHIVED && (
            <button
              type="button"
              className="btn btn-success btn-sm m-1"
              onClick={() =>
                isForeignNetwork ? acceptProposedTrace() : displayForeignNetRequiredWarning()
              }
            >
              <i className="fa fa-check-square-o" />
              &nbsp;Accept
            </button>
          )}
          <button
            type="button"
            className="btn btn-danger btn-sm m-1"
            onClick={() =>
              isForeignNetwork ? rejectProposedTrace() : displayForeignNetRequiredWarning()
            }
          >
            <i className="fa fa-times-circle-o" />
            &nbsp;Reject
          </button>
        </span>
      )}

      <ConversationModal ref={conversationModal} />
    </Fragment>
  );
};

AcceptRejectProposedTraceButtons.propTypes = {
  trace: PropTypes.oneOfType(
    [Trace, BridgedTrace, LPPCappedTrace, LPTrace].map(PropTypes.instanceOf),
  ).isRequired,
};

export default React.memo(AcceptRejectProposedTraceButtons);
