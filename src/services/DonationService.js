import { paramsForServer } from 'feathers-hooks-common';
import { feathersClient } from 'lib/feathersClient';

import Donation from '../models/Donation';

const getDonations = feathersClient.service('donations');

class DonationService {
  static getUserDonations({ currentUser, itemsPerPage, skipPages, subscribe, onResult, onError }) {
    const query = paramsForServer({
      schema: 'includeTypeDetails',
      query: {
        giverAddress: currentUser.address,
        lessThanCutoff: { $ne: true },
        $limit: itemsPerPage,
        $skip: skipPages * itemsPerPage,
        $sort: { createdAt: -1 },
      },
    });

    if (subscribe) {
      return this.subscribe(query, onResult, onError);
    }
    return this.getDonations(query, onResult, onError);
  }

  static getDonations(query, onResult, onError) {
    getDonations
      .find(query)
      .then(resp => {
        onResult({
          ...resp,
          data: resp.data.map(d => new Donation(d)),
        });
      })
      .catch(onError);
  }

  static subscribe(query, onResult, onError) {
    return getDonations
      .watch({ listStrategy: 'always' })
      .find(query)
      .subscribe(resp => {
        onResult({
          ...resp,
          data: resp.data.map(d => new Donation(d)),
        });
      }, onError);
  }
}

export default DonationService;
