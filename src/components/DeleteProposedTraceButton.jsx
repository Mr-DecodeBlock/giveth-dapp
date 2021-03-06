import React, { Fragment, useContext } from 'react';
import PropTypes from 'prop-types';
import { notification } from 'antd';

import TraceService from 'services/TraceService';
import Trace from 'models/Trace';
import ErrorPopup from 'components/ErrorPopup';
import confirmationDialog from 'lib/confirmationDialog';

import { authenticateUser } from '../lib/middleware';
import { Context as UserContext } from '../contextProviders/UserProvider';
import BridgedTrace from '../models/BridgedTrace';
import LPPCappedTrace from '../models/LPPCappedTrace';
import LPTrace from '../models/LPTrace';
import { Context as Web3Context } from '../contextProviders/Web3Provider';
import { sendAnalyticsTracking } from '../lib/SegmentAnalytics';

const DeleteProposedTraceButton = ({ trace, className }) => {
  const {
    state: { currentUser },
  } = useContext(UserContext);
  const {
    state: { web3 },
  } = useContext(Web3Context);

  const _confirmDeleteTrace = () => {
    TraceService.deleteProposedTrace({
      trace,
      onSuccess: () => {
        sendAnalyticsTracking('Trace Delete', {
          category: 'Trace',
          action: 'deleted',
          title: trace.title,
          traceId: trace.id,
          ownerId: trace.ownerAddress,
          traceType: trace.formType,
          traceRecipientAddress: trace.recipientAddress,
          parentCampaignId: trace.campaign.id,
          parentCampaignTitle: trace.campaign.title,
          reviewerAddress: trace.reviewerAddress,
          userAddress: currentUser.address,
        });
        notification.info({
          message: '',
          description: 'The Trace has been deleted.',
        });
      },
      onError: e => ErrorPopup('Something went wrong with deleting your Trace', e),
    });
  };

  const deleteProposedTrace = () => {
    authenticateUser(currentUser, false, web3).then(authenticated => {
      if (!authenticated) return;
      confirmationDialog('trace', trace.title, _confirmDeleteTrace);
    });
  };

  return (
    <Fragment>
      {trace.canUserDelete(currentUser) && (
        <span>
          <button
            type="button"
            className={`btn btn-danger btn-sm ${className}`}
            onClick={deleteProposedTrace}
          >
            <i className="fa fa-trash-o mr-2" />
            Delete
          </button>
        </span>
      )}
    </Fragment>
  );
};

DeleteProposedTraceButton.propTypes = {
  trace: PropTypes.oneOfType(
    [Trace, BridgedTrace, LPPCappedTrace, LPTrace].map(PropTypes.instanceOf),
  ).isRequired,
  className: PropTypes.string,
};

DeleteProposedTraceButton.defaultProps = {
  className: '',
};

export default React.memo(DeleteProposedTraceButton);
