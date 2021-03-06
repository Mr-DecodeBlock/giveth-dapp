import React, { Fragment, useContext } from 'react';
import PropTypes from 'prop-types';

import Trace from 'models/Trace';
import { authenticateUser, checkBalance } from 'lib/middleware';
import { history } from 'lib/helpers';
import { Context as Web3Context } from '../contextProviders/Web3Provider';
import { Context as UserContext } from '../contextProviders/UserProvider';
import BridgedTrace from '../models/BridgedTrace';
import LPPCappedTrace from '../models/LPPCappedTrace';
import LPTrace from '../models/LPTrace';
import ErrorHandler from '../lib/ErrorHandler';

const EditTraceButton = ({ trace, className }) => {
  const {
    state: { balance, isForeignNetwork, web3 },
    actions: { displayForeignNetRequiredWarning },
  } = useContext(Web3Context);
  const {
    state: { currentUser },
  } = useContext(UserContext);

  const goTraceEditPage = () => {
    if (!isForeignNetwork) {
      return displayForeignNetRequiredWarning();
    }
    return authenticateUser(currentUser, false, web3).then(authenticated => {
      if (!authenticated) return;
      checkBalance(balance)
        .then(() => {
          const { formType } = trace;
          if (
            [Trace.BOUNTYTYPE, Trace.EXPENSETYPE, Trace.PAYMENTTYPE, Trace.MILESTONETYPE].includes(
              formType,
            )
          ) {
            const newTraceEditUrl = `/${formType}/${trace._id}/edit`;
            history.push(newTraceEditUrl);
          } else {
            history.push(`/campaigns/${trace.campaignId}/traces/${trace._id}/edit`);
          }
        })
        .catch(err => ErrorHandler(err, 'Something went wrong on getting user balance.'));
    });
  };

  return (
    <Fragment>
      {trace.canUserEdit(currentUser) && (
        <button type="button" className={`btn ${className}`} onClick={goTraceEditPage}>
          <i className={className !== 'btn-link' ? 'fa fa-pencil' : 'fa fa-edit'} />
          &nbsp;Edit
        </button>
      )}
    </Fragment>
  );
};

EditTraceButton.propTypes = {
  trace: PropTypes.oneOfType(
    [Trace, BridgedTrace, LPPCappedTrace, LPTrace].map(PropTypes.instanceOf),
  ).isRequired,
  className: PropTypes.string,
};

EditTraceButton.defaultProps = {
  className: 'btn-link',
};

export default React.memo(EditTraceButton);
