const { withEntitlementsPlist } = require('@expo/config-plugins');

module.exports = function withLocalNotificationsOnly(config) {
  return withEntitlementsPlist(config, (result) => {
    // Inside & Out schedules reminders on the device and does not use remote push.
    delete result.modResults['aps-environment'];
    return result;
  });
};
