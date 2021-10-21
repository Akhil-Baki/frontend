import bean from 'bean';
import bonzo from 'bonzo';
import qwery from 'qwery';

import $ from 'lib/$';
import fastdom from 'lib/fastdom-promise';
import {fetchJson} from 'lib/fetch-json';
import {isBreakpoint, pageVisible, initPageVisibility} from 'lib/detect';
import mediator from 'lib/mediator';
import {enhanceTweets} from 'common/modules/article/twitter';
import {Sticky} from 'common/modules/ui/sticky';
import {scrollToElement} from 'lib/scroller';
import {init as initRelativeDates} from 'common/modules/ui/relativedates';
import {initNotificationCounter} from 'common/modules/ui/notification-counter';
import {checkElemsForVideos} from 'common/modules/atoms/youtube';


const updateBlocks = (opts, pollUpdates) => {
    const options = Object.assign(
        {
            toastOffsetTop: 12,
            minUpdateDelay: (isBreakpoint({min: 'desktop'}) ? 10 : 30) * 1000,
            maxUpdateDelay: 20 * 60 * 1000, // 20 mins
            backoffMultiplier: 0.75, // increase or decrease the back off rate by modifying this
        },
        opts
    );

    // Cache selectors
    const $liveblogBody = $('.js-liveblog-body');
    const $toastButton = $('.toast__button');
    const $filterButton = $('.filter__button');
    const $toastText = $('.toast__text', $toastButton);
    const toastContainer = qwery('.toast__container')[0];
    let currentUpdateDelay = options.minUpdateDelay;
    let latestBlockId = $liveblogBody.data('most-recent-block');
    let unreadBlocksNo = 0;
    let updateTimeoutId;
    let filterStatus = false;


    const updateDelay = (delay) => {
        let newDelay;

        if (pageVisible()) {
            newDelay = options.minUpdateDelay;
        } else {
            newDelay = Math.min(delay * 1.5, options.maxUpdateDelay);
        }

        currentUpdateDelay = newDelay;
    };

    const scrolledPastTopBlock = () =>
        $liveblogBody.offset().top < window.pageYOffset;

    // TODO:: Find out what this check was originally for. It was previously called isLivePage but both live and dead pages have '?page=' param if a link (such as key events) are clicked
    const hasPageParams = window.location.search.includes('?page=');
    const revealInjectedElements = () => {
        fastdom.mutate(() => {
            $('.autoupdate--hidden', $liveblogBody)
                .addClass('autoupdate--highlight')
                .removeClass('autoupdate--hidden');
            mediator.emit('modules:autoupdate:unread', 0);
        });
    };

    const toastButtonRefresh = () => {
        fastdom.mutate(() => {
            if (unreadBlocksNo > 0) {
                const updateText =
                    unreadBlocksNo > 1 ? ' new updates' : ' new update';
                $toastButton.removeClass('toast__button--closed');
                $(toastContainer).addClass('toast__container--open');
                $toastText.html(unreadBlocksNo + updateText);
            } else {
                $toastButton
                    .removeClass('loading')
                    .addClass('toast__button--closed');
                $(toastContainer).removeClass('toast__container--open');
            }
        });
    };

    const injectNewBlocks = (newBlocks, isUserInteraction) => {
        // Clean up blocks before insertion
        const resultHtml = $.create(`<div>${newBlocks}</div>`)[0];
        let elementsToAdd;

        fastdom.mutate(() => {
            bonzo(resultHtml.children).addClass('autoupdate--hidden');
            elementsToAdd = Array.from(resultHtml.children);
            if (isUserInteraction) {
                $liveblogBody.empty()
                mediator.emit('modules:autoupdate:user-interaction');
            }

            // Insert new blocks
            $liveblogBody.prepend(elementsToAdd)
            mediator.emit('modules:autoupdate:updates', elementsToAdd.length);
            initRelativeDates();
            enhanceTweets();
            checkElemsForVideos(elementsToAdd);
        });
    };

    const displayNewBlocks = () => {
        if (pageVisible()) {
            revealInjectedElements();
        }

        unreadBlocksNo = 0;
        toastButtonRefresh();
    };

    const checkForUpdates = (auto = true) => {
        if (updateTimeoutId !== undefined) {
            clearTimeout(updateTimeoutId);
        }

        let count = 0;
        const filterByKeyEvents = `&filterByKeyEvents=${filterStatus ? 'true' : 'false'}`;
        const isUserInteraction = !auto
        const userInteraction = `&userInteraction=${isUserInteraction}`
        const userUpdate = !hasPageParams || isUserInteraction
        const shouldFetchBlocks = `&isLivePage=${
            userUpdate ? 'true' : 'false'
        }`;
        const latestBlockIdToUse = latestBlockId || 'block-0';
        const params = `?lastUpdate=${latestBlockIdToUse}${shouldFetchBlocks}${filterByKeyEvents}${userInteraction}`;
        const endpoint = `${window.location.pathname}.json${params}`;

        // #? One day this should be in Promise.finally()
        const setUpdateDelay = () => {
            if (count === 0 || currentUpdateDelay > 0) {
                updateDelay(currentUpdateDelay);

                updateTimeoutId = setTimeout(
                    checkForUpdates,
                    currentUpdateDelay
                );
            } else {
                // might have been cached so check straight away
                updateTimeoutId = setTimeout(checkForUpdates, 1);
            }
        };

        return fetchJson(endpoint, {
            mode: 'cors',
        })
            .then(resp => {
                count = resp.numNewBlocks;
                if (count > 0) {
                    unreadBlocksNo += count;

                    // updates notification bar with number of unread blocks
                    mediator.emit('modules:autoupdate:unread', unreadBlocksNo);

                    latestBlockId = resp.mostRecentBlockId;
                    if (userUpdate) {
                        injectNewBlocks(resp.html, isUserInteraction);
                        if (scrolledPastTopBlock() && !isUserInteraction) {
                            toastButtonRefresh();
                        } else {
                            displayNewBlocks();
                        }
                    } else {
                        toastButtonRefresh();
                    }
                }
                pollUpdates && setUpdateDelay();
            })
            .catch(() => {
                pollUpdates && setUpdateDelay();
            });
    };

    const setUpListeners = () => {
        bean.on(document.body, 'click', '.filter__button', () => {
            filterStatus = !filterStatus;
            checkForUpdates(false)
        })

        bean.on(document.body, 'click', '.toast__button', () => {
            if (!hasPageParams) {
                fastdom.measure(() => {
                    scrollToElement(qwery('.blocks')[0], 300, 'easeOutQuad');

                    fastdom
                        .mutate(() => {
                            $toastButton.addClass('loading');
                        })
                        .then(() => {
                            displayNewBlocks();
                        });
                });
            } else {
                window.location.assign(window.location.pathname);
            }
        });

        mediator.on('modules:toast__tofix:unfixed', () => {
            if (!hasPageParams && unreadBlocksNo > 0) {
                fastdom
                    .mutate(() => {
                        $toastButton.addClass('loading');
                    })
                    .then(() => {
                        displayNewBlocks();
                    });
            }
        });

        mediator.on('modules:detect:pagevisibility:visible', () => {
            if (unreadBlocksNo === 0) {
                revealInjectedElements();
            }

            currentUpdateDelay = 0; // means please get us fully up to date
            checkForUpdates(true);
        });

        mediator.on('modules:autoupdate:user-interaction', () => {
            fastdom.measure(() => {
                scrollToElement(qwery('.content__meta-container'), 300, 'easeOutQuad');

                fastdom
                    .mutate(() => {
                        revealInjectedElements();
                    })
                    .then(() => {
                        displayNewBlocks();
                    }).then(() => {
                    bonzo($filterButton).html(filterStatus ? "Show all events" : "Filter by key events")
                });

            });
        });

    };

    // init
    initNotificationCounter();

    new Sticky(toastContainer, {
        top: options.toastOffsetTop,
        emitMessage: true,
        containInParent: false,
    }).init();

    checkForUpdates(true);
    initPageVisibility();
    setUpListeners();

    fastdom.mutate(() => {
        // Enables the animations for injected blocks
        $liveblogBody.addClass('autoupdate--has-animation');
    });
};

export {updateBlocks};
