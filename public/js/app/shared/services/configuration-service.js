/**
 * [y] hybris Platform
 *
 * Copyright (c) 2000-2014 hybris AG
 * All rights reserved.
 *
 * This software is the confidential and proprietary information of hybris
 * ("Confidential Information"). You shall not disclose such Confidential
 * Information and shall use it only in accordance with the terms of the
 * license agreement you entered into with hybris.
 */
'use strict';

/**
 *  Encapsulates access to the configuration service.
 */
angular.module('ds.shared')
    .factory('ConfigSvc', ['$q', 'settings', 'GlobalData', 'ConfigurationREST', 'AuthSvc', 'AccountSvc', 'CartSvc', '$window', '$rootScope',
        function ($q, settings, GlobalData, ConfigurationREST, AuthSvc, AccountSvc, CartSvc, $window, $rootScope) {
            var initialized = false;

            /**
             * Loads the store configuration settings - the public Stripe key, store name and logo.
             * These settings are then stored in the GlobalData service.
             * Returns promise once done.
             */
            function loadConfiguration() {
                var configPromise = ConfigurationREST.Config.one('configurations').get().then(function (result) {
                    var key = null;
                    var value = null;

                    for (var i=0,  tot=result.length; i < tot; i++) {
                        var entry = result[i];
                        key =  entry.key;
                        value = entry.value;
                        if(key === settings.configKeys.stripeKey) {
                            /* jshint ignore:start */
                            Stripe.setPublishableKey(value);
                            /* jshint ignore:end */
                        } else if (key === settings.configKeys.storeName) {
                            GlobalData.store.name = value;
                        } else if (key === settings.configKeys.storeLogo) {
                            GlobalData.store.logo = value;
                        } else if (key === settings.configKeys.storeCurrencies) {
                            GlobalData.setAvailableCurrencies(JSON.parse(value));
                        }
                    }
                    settings.facebookAppId = '580437175395043';
                    return result;
                }, function (error) {
                    console.error('Store settings retrieval failed: ' + JSON.stringify(error));
                });
                return configPromise;

            }


            return {

                /**
                 * Returns an empty promise that is resolved once the app has been initialized with all essential data.
                 */
                initializeApp: function () {
                    var def = $q.defer();
                    if (initialized) {
                        def.resolve({});
                    } else {
                        loadConfiguration(GlobalData.store.tenant).finally(function () {
                            // load FaceBook SDK

                            $window.fbAsyncInit = function() {
                                FB.init({
                                    appId      : settings.facebookAppId,
                                    xfbml      : true,
                                    version    : 'v2.1'
                                });
                            };
                            (function(d, s, id) {
                                var js, fjs = d.getElementsByTagName(s)[0];
                                if (d.getElementById(id)){
                                    return;
                                }
                                js = d.createElement(s); js.id = id;
                                js.src = '//connect.facebook.net/en_US/sdk.js';
                                fjs.parentNode.insertBefore(js, fjs);
                            }(document, 'script', 'facebook-jssdk'));

                            //
                            var languageSet = false;
                            var currencySet = false;
                            if (AuthSvc.isAuthenticated()) { // if session still in tact, load use preferences
                                AccountSvc.account().then(function (account) {
                                    if (account.preferredLanguage) {
                                        GlobalData.setLanguage(account.preferredLanguage.split('_')[0]);
                                        languageSet = true;
                                    }
                                    if (account.preferredCurrency) {
                                        GlobalData.setCurrency(account.preferredCurrency);
                                        currencySet = true;
                                    }
                                });
                            }
                            if (!languageSet) {
                                GlobalData.loadLanguageFromCookie();
                            }
                            if (!currencySet) {
                                GlobalData.loadInitialCurrency();
                            }
                            def.resolve({});
                            initialized = true;

                            CartSvc.getCart().then(function (cart) {
                                if (cart.currency !== GlobalData.getCurrencyId()) {
                                    CartSvc.switchCurrency(GlobalData.getCurrencyId());
                                }
                            });
                            AuthSvc.watchFBLoginChange();
                        });
                    }
                    return def.promise;
                }


            };
        }]);
