import React, { memo, useContext, useEffect, useState, Fragment } from 'react';
import { Button, Col, Form, notification, PageHeader, Row } from 'antd';
import 'antd/dist/antd.css';
import PropTypes from 'prop-types';
import useCampaign from '../../hooks/useCampaign';
import {
  MilestoneCampaignInfo,
  MilestoneDescription,
  MilestoneDonateToDac,
  MilestonePicture,
  MilestoneReviewer,
  MilestoneTitle,
} from '../EditMilestoneCommons';
import { Context as UserContext } from '../../contextProviders/UserProvider';
import { Context as Web3Context } from '../../contextProviders/Web3Provider';
import { authenticateUser } from '../../lib/middleware';
import LPMilestone from '../../models/LPMilestone';
import { ANY_TOKEN, history } from '../../lib/helpers';
import config from '../../configuration';
import { Milestone } from '../../models';
import { MilestoneService } from '../../services';
import ErrorHandler from '../../lib/ErrorHandler';
import Web3ConnectWarning from '../Web3ConnectWarning';

function CreateBounty(props) {
  const {
    state: { currentUser },
  } = useContext(UserContext);
  const {
    state: { isForeignNetwork },
    actions: { displayForeignNetRequiredWarning },
  } = useContext(Web3Context);

  const campaignId = props.match.params.id;

  const campaign = useCampaign(campaignId);
  const [bounty, setBounty] = useState({
    title: '',
    description: '',
    picture: '',
    donateToDac: true,
    reviewerAddress: '',
  });

  const [loading, setLoading] = useState(false);
  const [userIsCampaignOwner, setUserIsOwner] = useState(false);

  useEffect(() => {
    setUserIsOwner(
      campaign &&
        currentUser.address &&
        [campaign.ownerAddress, campaign.coownerAddress].includes(currentUser.address),
    );
  }, [campaign, currentUser]);

  const handleInputChange = event => {
    const { name, value, type, checked } = event.target;
    if (type === 'checkbox') {
      setBounty({ ...bounty, [name]: checked });
    } else {
      setBounty({ ...bounty, [name]: value });
    }
  };

  function setReviewer(_, option) {
    handleInputChange({
      target: { name: 'reviewerAddress', value: option.value },
    });
  }

  function setPicture(address) {
    handleInputChange({ target: { name: 'picture', value: address } });
  }

  function goBack() {
    history.goBack();
  }

  const submit = async () => {
    const authenticated = await authenticateUser(currentUser, false);

    if (authenticated) {
      if (userIsCampaignOwner && !isForeignNetwork) {
        displayForeignNetRequiredWarning();
        return;
      }

      const { title, description, reviewerAddress, picture } = bounty;
      const ms = new LPMilestone({
        title,
        description,
        reviewerAddress,
        recipientId: campaign.projectId,
        token: ANY_TOKEN,
        image: picture,
      });

      ms.ownerAddress = currentUser.address;
      ms.campaignId = campaignId;
      ms.parentProjectId = campaign.projectId;

      if (bounty.donateToDac) {
        ms.dacId = config.defaultDacId;
      }

      if (!userIsCampaignOwner) {
        ms.status = Milestone.PROPOSED;
      }

      setLoading(true);

      await MilestoneService.save({
        milestone: ms,
        from: currentUser.address,
        afterSave: (created, txUrl, res) => {
          let notificationDescription;
          if (created) {
            if (!userIsCampaignOwner) {
              notificationDescription = 'Bounty proposed to the Campaign Owner';
            }
          } else if (txUrl) {
            notificationDescription = (
              <p>
                Your Bounty is pending....
                <br />
                <a href={txUrl} target="_blank" rel="noopener noreferrer">
                  View transaction
                </a>
              </p>
            );
          } else {
            notificationDescription = 'Your Bounty has been updated!';
          }

          if (description) {
            notification.info({ description: notificationDescription });
          }
          setLoading(false);
          history.push(`/campaigns/${campaignId}/milestones/${res._id}`);
        },
        afterMined: (created, txUrl) => {
          notification.success({
            description: (
              <p>
                Your Bounty has been created!
                <br />
                <a href={txUrl} target="_blank" rel="noopener noreferrer">
                  View transaction
                </a>
              </p>
            ),
          });
        },
        onError(message, err) {
          setLoading(false);
          return ErrorHandler(err, message);
        },
      });
    }
  };

  return (
    <Fragment>
      <Web3ConnectWarning />
      <div id="create-milestone-view">
        <Row>
          <Col span={24}>
            <PageHeader
              className="site-page-header my-test"
              onBack={goBack}
              title="Create New Bounty"
              ghost={false}
            />
          </Col>
        </Row>
        <Row>
          <div className="card-form-container">
            <Form className="card-form" requiredMark onFinish={submit}>
              <div className="card-form-header">
                <img src={`${process.env.PUBLIC_URL}/img/bounty.png`} alt="bounty-logo" />
                <div className="title">Bounty</div>
              </div>

              <MilestoneCampaignInfo campaign={campaign} />

              <div className="section">
                <div className="title">Bounty details</div>

                <MilestoneTitle
                  value={bounty.title}
                  onChange={handleInputChange}
                  extra="What is this Bounty about?"
                />

                <MilestoneDescription
                  value={bounty.description}
                  onChange={handleInputChange}
                  extra="Explain the requirements and what success looks like."
                  placeholder="Describe the Bounty and define the acceptance criteria..."
                />

                <MilestonePicture
                  setPicture={setPicture}
                  milestoneTitle={bounty.title}
                  picture={bounty.picture}
                />

                <MilestoneDonateToDac value={bounty.donateToDac} onChange={handleInputChange} />

                <MilestoneReviewer
                  milestoneType="Bounty"
                  setReviewer={setReviewer}
                  hasReviewer
                  milestoneReviewerAddress={bounty.reviewerAddress}
                />
              </div>

              <div className="milestone-desc">
                Your bounty will collect funds in any currency. The total amount collected will be
                the Bounty Reward.
              </div>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading}>
                  {userIsCampaignOwner ? 'Create' : 'Propose'}
                </Button>
              </Form.Item>
            </Form>
          </div>
        </Row>
      </div>
    </Fragment>
  );
}

CreateBounty.propTypes = {
  match: PropTypes.shape({
    params: PropTypes.shape({
      id: PropTypes.string,
      milestoneId: PropTypes.string,
    }).isRequired,
  }).isRequired,
};

const isEqual = (prevProps, nextProps) => prevProps.match.params.id === nextProps.match.params.id;

export default memo(CreateBounty, isEqual);