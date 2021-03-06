import React, { useContext, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

import { Link } from 'react-router-dom';
import Avatar from 'react-avatar';

import Balances from 'components/Balances';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { Col, Row } from 'antd';
import Loader from '../Loader';
import BackgroundImageHeader from '../BackgroundImageHeader';
import DonateButton from '../DonateButton';
import AggregateDonationService from '../../services/AggregateDonationService';
import LeaderBoard from '../LeaderBoard';
import CommunityButton from '../CommunityButton';
import Community from '../../models/Community';
import ProjectSubscription from '../ProjectSubscription';
import { getUserName, getUserAvatar, history } from '../../lib/helpers';
import CommunityService from '../../services/CommunityService';
import CampaignService from '../../services/CampaignService';
import CampaignCard from '../CampaignCard';
import config from '../../configuration';
import NotFound from './NotFound';
import { checkBalance } from '../../lib/middleware';
import DescriptionRender from '../DescriptionRender';
import ErrorBoundary from '../ErrorBoundary';
import GoBackSection from '../GoBackSection';
import ErrorHandler from '../../lib/ErrorHandler';
import { Context as Web3Context } from '../../contextProviders/Web3Provider';
import { Context as UserContext } from '../../contextProviders/UserProvider';
import Donation from '../../models/Donation';
import { feathersClient } from '../../lib/feathersClient';

/**
 * The Community detail view mapped to /communities/id
 *
 * @param currentUser  Currently logged in user information
 * @param history      Browser history object
 */

const helmetContext = {};

const ViewCommunity = ({ match }) => {
  const {
    state: { balance },
  } = useContext(Web3Context);
  const {
    state: { currentUser },
  } = useContext(UserContext);

  const [community, setCommunities] = useState({});
  const [isLoading, setLoading] = useState(true);
  const [isLoadingDonations, setLoadingDonations] = useState(true);
  const [isLoadingCampaigns, setLoadingCampaigns] = useState(true);
  const [campaigns, setCampaigns] = useState([]);
  const [aggregateDonations, setAggregateDonations] = useState([]);
  const [aggregateDonationsTotal, setAggregateDonationsTotal] = useState(0);
  const [newDonations, setNewDonations] = useState(0);
  const [notFound, setNotFound] = useState(false);
  const [batchNumber, setBatchNumber] = useState(1);

  const donationsPerBatch = 5;
  let _aggregateDonations = [];

  const subscribeDonations = useRef();

  const cleanUp = () => {
    if (subscribeDonations.current) {
      subscribeDonations.current.unsubscribe();
      subscribeDonations.current = undefined;
    }
  };

  const loadMore = () => {
    setBatchNumber(batchNumber + 1);
  };

  const loadMoreAggregateDonations = (loadFromScratch = false, _batchNumber = batchNumber) => {
    setLoadingDonations(true);
    AggregateDonationService.get(
      community.id,
      loadFromScratch ? donationsPerBatch * _batchNumber : donationsPerBatch,
      loadFromScratch ? 0 : aggregateDonations.length,
      (_donations, _donationsTotal) => {
        let nDonations;
        if (loadFromScratch) {
          nDonations = _donations.map(_aggregate => {
            // Finding the user who has newly donated to highlight it later
            const oldAggregateItem = _aggregateDonations.filter(
              aggregate => aggregate._id === _aggregate._id && aggregate.count !== _aggregate.count,
            );
            if (oldAggregateItem.length) {
              _aggregate.isNew = true;
              return _aggregate;
            }
            return _aggregate;
          });
        }
        _aggregateDonations = loadFromScratch ? nDonations : aggregateDonations.concat(_donations);
        setAggregateDonations(_aggregateDonations);
        setAggregateDonationsTotal(_donationsTotal);
        setLoadingDonations(false);
      },
      err => {
        setLoadingDonations(false);
        ErrorHandler(err, 'Some error on fetching donations, please try again later');
      },
    );
  };

  const subscribeNewDonations = (id, onSuccess, onError) => {
    let initialTotal;
    subscribeDonations.current = feathersClient
      .service('donations')
      .watch({ listStrategy: 'always' })
      .find({
        query: {
          status: { $ne: Donation.FAILED },
          delegateTypeId: id,
          isReturn: false,
          intendedProjectId: { $exists: false },
          $limit: 0,
        },
      })
      .subscribe(resp => {
        if (initialTotal === undefined) {
          initialTotal = resp.total;
          onSuccess(0);
        } else {
          onSuccess(resp.total - initialTotal);
        }
      }, onError);
  };

  useEffect(() => {
    const { id, slug } = match.params;
    const getFunction = slug
      ? CommunityService.getBySlug.bind(CommunityService, slug)
      : CommunityService.get.bind(CommunityService, id);
    // Get the Community
    getFunction()
      .then(async _community => {
        if (id) {
          history.push(`/community/${_community.slug}`);
        }
        setCommunities(_community);
        setLoading(false);
      })
      .catch(err => {
        setNotFound(true);
        ErrorHandler(err, 'Some error on fetching community info, please try again later');
      });

    return cleanUp;
  }, [newDonations]);

  useEffect(() => {
    const subscribeFunc = async () => {
      if (community.id) {
        const relatedCampaigns = await CampaignService.getCampaignsByIdArray(
          community.campaigns || [],
        );
        setCampaigns(relatedCampaigns);
        setLoadingCampaigns(false);
        loadMoreAggregateDonations(true);
        cleanUp();
        // subscribe to donation count
        subscribeNewDonations(
          community.id,
          _newDonations => {
            if (_newDonations > newDonations) {
              setNewDonations(_newDonations);
              loadMoreAggregateDonations(true, batchNumber);
            }
          },
          err => {
            ErrorHandler(err, 'Some error on fetching community donations, please try again later');
            setNewDonations(0);
          },
        );
      }
    };
    subscribeFunc().then();

    return cleanUp;
  }, [community.id, batchNumber]);

  const editCommunity = id => {
    checkBalance(balance)
      .then(() => {
        history.push(`/communities/${id}/edit`);
      })
      .catch(err => ErrorHandler(err, 'Something went wrong on getting user balance.'));
  };

  const renderDescription = () => {
    return DescriptionRender(community.description);
  };

  if (notFound) {
    return <NotFound projectType="Community" />;
  }

  const userIsOwner =
    community && community.owner && community.owner.address === currentUser.address;

  const campaignsTitle = `Campaigns${campaigns.length ? ` (${campaigns.length})` : ''}`;
  const leaderBoardTitle = `Leaderboard${
    aggregateDonationsTotal ? ` (${aggregateDonationsTotal})` : ''
  }`;

  const goBackSectionLinks = [
    { title: 'About', inPageId: 'description' },
    {
      title: leaderBoardTitle,
      inPageId: 'donations',
    },
    { title: 'Funding', inPageId: 'funding' },
    {
      title: campaignsTitle,
      inPageId: 'campaigns',
    },
  ];

  return (
    <HelmetProvider context={helmetContext}>
      <ErrorBoundary>
        <div id="view-cause-view">
          {isLoading && <Loader className="fixed" />}

          {!isLoading && (
            <div>
              <Helmet>
                <title>{community.title}</title>
              </Helmet>
              <BackgroundImageHeader image={community.image} adminId={community.delegateId}>
                <h6>COMMUNITY</h6>
                <h1>{community.title}</h1>

                {userIsOwner && community.isActive && (
                  <button
                    type="button"
                    className="btn m-1 ghostButtonHeader btn-sm btn-primary"
                    onClick={() => editCommunity(community.id)}
                  >
                    <i className="fa fa-pencil" />
                    &nbsp;Edit
                  </button>
                )}

                {community.isActive && (
                  <div className="mt-4">
                    <DonateButton
                      model={{
                        type: Community.type,
                        title: community.title,
                        slug: community.slug,
                        ownerAddress: community.ownerAddress,
                        id: community.id,
                        token: { symbol: config.nativeTokenName },
                        adminId: community.delegateId,
                      }}
                      autoPopup
                      size="large"
                    />
                  </div>
                )}
              </BackgroundImageHeader>

              <GoBackSection
                backUrl="/communities"
                backButtonTitle="Communities"
                projectTitle={community.title}
                inPageLinks={goBackSectionLinks}
              />

              <div className="container-fluid mt-4">
                <div className="row">
                  <div className="col-md-8 m-auto">
                    <div id="description">
                      <div>
                        <h5 className="title">Subscribe to updates </h5>
                        <ProjectSubscription
                          projectTypeId={community._id}
                          projectType="community"
                        />
                      </div>
                      <div className="about-section-header">
                        <h5 className="title">About</h5>
                        <div className="text-center">
                          <Link to={`/profile/${community.owner.address}`}>
                            <Avatar size={50} src={getUserAvatar(community.owner)} round />
                            <p className="small">{getUserName(community.owner)}</p>
                          </Link>
                        </div>
                      </div>

                      <div className="card content-card">
                        <div className="card-body content">{renderDescription()}</div>

                        {community.communityUrl && (
                          <div className="pl-3 pb-4">
                            <CommunityButton
                              className="btn btn-secondary"
                              url={community.communityUrl}
                            >
                              Join our Community
                            </CommunityButton>
                          </div>
                        )}
                      </div>
                    </div>

                    <div id="donations" className="spacer-top-50">
                      <Row justify="space-between mb-3">
                        <Col span={12} className="align-items-center d-flex">
                          <h5 className="mb-0">{leaderBoardTitle}</h5>
                          {newDonations > 0 && (
                            <span
                              className="badge badge-primary ml-4"
                              style={{ fontSize: '12px', padding: '6px' }}
                            >
                              {newDonations} NEW
                            </span>
                          )}
                        </Col>
                        <Col span={12}>
                          {community.isActive && (
                            <Row gutter={[16, 16]} justify="end">
                              <Col xs={24} sm={12} lg={8}>
                                <DonateButton
                                  model={{
                                    type: Community.type,
                                    title: community.title,
                                    slug: community.slug,
                                    ownerAddress: community.ownerAddress,
                                    id: community.id,
                                    token: { symbol: config.nativeTokenName },
                                    adminId: community.delegateId,
                                  }}
                                />
                              </Col>
                            </Row>
                          )}
                        </Col>
                      </Row>
                      <LeaderBoard
                        aggregateDonations={aggregateDonations}
                        isLoading={isLoadingDonations}
                        total={aggregateDonationsTotal}
                        loadMore={loadMore}
                        newDonations={newDonations}
                      />
                    </div>

                    <div id="funding" className="spacer-top-50">
                      <Row justify="space-between">
                        <Col span={12}>
                          <h5>Funding</h5>
                        </Col>
                        <Col span={12}>
                          {community.isActive && (
                            <Row gutter={[16, 16]} justify="end">
                              <Col xs={24} sm={12} lg={8}>
                                <DonateButton
                                  model={{
                                    type: Community.type,
                                    title: community.title,
                                    slug: community.slug,
                                    ownerAddress: community.ownerAddress,
                                    id: community.id,
                                    token: { symbol: config.nativeTokenName },
                                    adminId: community.delegateId,
                                  }}
                                />
                              </Col>
                            </Row>
                          )}
                        </Col>
                      </Row>
                      <Balances entity={community} />
                    </div>

                    <div id="campaigns" className="spacer-top-50 spacer-bottom-50">
                      <Row justify="space-between">
                        <Col span={12}>
                          <h5>{campaignsTitle}</h5>
                        </Col>
                        <Col span={12}>
                          {community.isActive && (
                            <Row gutter={[16, 16]} justify="end">
                              <Col xs={24} sm={12} lg={8}>
                                <DonateButton
                                  model={{
                                    type: Community.type,
                                    title: community.title,
                                    slug: community.slug,
                                    ownerAddress: community.ownerAddress,
                                    id: community.id,
                                    token: { symbol: config.nativeTokenName },
                                    adminId: community.delegateId,
                                  }}
                                />
                              </Col>
                            </Row>
                          )}
                        </Col>
                      </Row>
                      <p>
                        These Campaigns are working hard to solve the cause of this Community
                        (Community)
                      </p>
                      {isLoadingCampaigns && <Loader className="small" />}

                      {campaigns.length > 0 && !isLoadingCampaigns && (
                        <div className="cards-grid-container">
                          {campaigns.map(c => (
                            <CampaignCard key={c.id} campaign={c} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ErrorBoundary>
    </HelmetProvider>
  );
};

ViewCommunity.propTypes = {
  match: PropTypes.shape({
    params: PropTypes.shape({
      id: PropTypes.string,
      slug: PropTypes.string,
    }).isRequired,
  }).isRequired,
};

export default ViewCommunity;
