(function () {
    'use strict';
    angular.module('skillclub.team', [])

        .controller('teamsCtrl', ['$scope', '$rootScope', 'toastr', function ($scope, $rootScope, toastr) {
            $scope._email = '';
            $scope.submitRequestAnInvite = function (form) {
                if (ProductionMode) {
                    $scope.mixpanelTrack('Team Invite Request', {email: $scope._email});
                }
                $scope.showNotification('Thank you for your interest! We\'ll be reaching out soon.');
                $scope._email = '';
            };

            $('.icon-down-landing').click(function () {
                $('html, body').animate({
                    scrollTop: $(".bloq-landing-2").offset().top
                }, 300);
            });
        }])

        .controller('teamSettingsCtrl', ['$filter', '$scope', '$rootScope', 'toastr', '$modal', 'ResourceTeamService', 'configGlobal', '$stateParams', '$state', 'fileUpload', '$compile', function ($filter, $scope, $rootScope, toastr, $modal, ResourceTeamService, configGlobal, $stateParams, $state, fileUpload, $compile) {

            $scope.hostname = configGlobal.getUrlApi();
            $scope.default = '/images/default-user.png';
            $scope.listMembers = [];
            $scope.listRoles = [];
            $scope.team = {};

            ResourceTeamService.getRoles()
                .then(function (response) {
                    $scope.listRoles = response.data.team_roles;
                }, function (response) {
                    console.log(response);
                    $scope.showNotification(response.data.message, 'error');
                });


            $scope.find = function () {

                var team = $stateParams.slug;

                ResourceTeamService.getTeamBySlug(team)
                    .then(function (response) {
                        $scope.listMembers = [];
                        $scope.team = response.data;

                        angular.forEach(response.data.members, function (member) {
                            if (!member.profile_pic) {
                                if (member.name)
                                    member.namePoint = $filter('photoDefault')(member.name);
                                member.notPicture = false;
                            } else
                                member.notPicture = true;
                            $scope.listMembers.push(member);
                        });
                    }, function (response) {
                        $state.go('404');
                    });
            };

            $scope.remove = function (team, member, index) {

                var modalInstance = $modal.open({
                    animation: true,
                    templateUrl: 'template/modal-confirm.html',
                    controller: 'ConfirmModalCtrl'
                });

                modalInstance.result.then(function (confirm) {
                    if (confirm) {
                        ResourceTeamService.removeMemberTeam(team, member)
                            .then(function (response) {
                                console.log(response);
                                $scope.listMembers.splice(index, 1);
                                $scope.showNotification('Member was removed ');

                            }, function (response) {
                                console.log(response);
                                $scope.showNotification(response.data.message, 'error');
                            });
                    }
                    modalInstance.close();
                });
            };

            $scope.editMember = function (member, team, index) {
                var modalInstance = $modal.open({
                    animation: true,
                    templateUrl: 'template/modal-member-edit.html',
                    controller: 'modalEditMemberCtrl',
                    resolve: {
                        objectDataMember: function () {
                            var data = {
                                team: team,
                                member: member,
                                index: index,
                                roles: $scope.listRoles,
                                listMembers: $scope.listMembers
                            };
                            return data;
                        }
                    }
                });
            };

            $scope.addMember = function (team) {
                var modalInstance = $modal.open({
                    animation: true,
                    templateUrl: 'template/modal-member-add.html',
                    controller: 'modalMemberCtrl',
                    resolve: {
                        objectDataMember: function () {
                            var data = {
                                team: team
                            };
                            return data;
                        }
                    }
                });
            };

            $scope.submitDataTeam = function (dataTeam) {
                var _dataTeam = {
                    id: $scope.team._id,
                    name: $scope.team.name
                };
                ResourceTeamService.updateDataTeam(_dataTeam)
                    .then(function (response) {
                        console.log(response);
                        $scope.showNotification('Updated!');
                        $state.go('settingsteams', {slug: response.data.slug});
                    }, function (response) {
                        console.log(response);
                        $scope.showNotification(response.data.message, 'error');
                    });
            };

            $scope.change = function () {
                $('#file-upload-button').click();
            };

            $scope.uploadFile = function () {
                if ($scope.myFile.size > 2097152) {
                    $scope.showNotification('The picture must have a maximum size of 2MB.', 'error');
                } else {
                    fileUpload.uploadTeamFileToUrl($scope.myFile, $scope.team._id)
                        .then(function (response) {
                            console.log(response);
                            $scope.team.logo = response.data.photo + '?' + new Date().getTime();
                            $scope.showNotification('Looking good! Picture updated.');
                        }, function (response) {
                            if (response.data.message) {
                                $scope.showNotification(response.data.message, 'error');
                            } else {
                                $scope.showNotification('Please try with a smaller picture.', 'error');
                            }
                        });
                }

            };

        }])

        .controller('ConfirmModalCtrl', ['$scope', '$rootScope', 'toastr', '$modal', '$modalInstance', function ($scope, $rootScope, toastr, $modal, $modalInstance) {
            $scope.cancel = function (action) {
                $modalInstance.close(action);
            };
        }])

        .controller('teamWelcomeCtrl', ['$scope', '$rootScope', 'toastr', '$stateParams', 'ResourceTeamService', 'configGlobal', '$state', function ($scope, $rootScope, toastr, $stateParams, ResourceTeamService, configGlobal, $state) {

            $scope.hostname = configGlobal.getUrlApi();
            $scope.default = '/images/default-user.png';
            $scope.listMembers = [];
            $scope.team = {};

            $scope.accepted = function () {

                var team = $stateParams.team;
                var username = $stateParams.invited;

                ResourceTeamService.acceptedMemberTeam(team, username)
                    .then(function (response) {

                        console.log(response);

                        $state.go('activity', {slug: response.data.slug});

                    }, function (response) {
                        $state.go('404');

                        console.log(response);
                        $scope.showNotification(response.data.message, 'error');


                    });
            };

        }])

        .controller('modalMemberCtrl', ['$scope', '$rootScope', 'toastr', '$modal', '$modalInstance', 'ResourceTeamService', 'objectDataMember', function ($scope, $rootScope, toastr, $modal, $modalInstance, ResourceTeamService, objectDataMember) {

            var team = objectDataMember.team;

            $scope.cancel = function () {
                $modalInstance.dismiss('cancel');
                document.activeElement.blur();
            };


            $scope.sendInvitedTeam = function () {

                var id = team._id;
                var email = $scope.email;
                ResourceTeamService.inviteMemberTeam(id, email)
                    .then(function (response) {
                        console.log(response);
                        $scope.cancel();
                        $scope.showNotification('Invitation sent!');
                    }, function (response) {
                        console.log(response);
                        $scope.showNotification(response.data.message, 'error');
                    });
            };
        }])

        .controller('modalEditMemberCtrl', ['$scope', '$rootScope', 'toastr', '$modal', '$modalInstance', 'objectDataMember', 'ResourceTeamService', 'configGlobal', function ($scope, $rootScope, toastr, $modal, $modalInstance, objectDataMember, ResourceTeamService, configGlobal) {

            $scope.hostname = configGlobal.getUrlApi();

            $scope.roles = objectDataMember.roles;
            $scope.member = objectDataMember.member;
            $scope.team = objectDataMember.team;
            $scope.index = objectDataMember.index;
            $scope.listMembers = objectDataMember.listMembers;

            $scope.edit = function (formMemberEdit) {
                ResourceTeamService.editMemberTeam({team: $scope.team, member: $scope.member})
                    .then(function (response) {
                        console.log(response);
                        $scope.cancel();
                        $scope.showNotification('Updated!');
                    }, function (response) {
                        console.log(response);
                        $scope.showNotification(response.data.message, 'error');
                    });
            };

            $scope.removeMember = function () {

                var modalInstance = $modal.open({
                    animation: true,
                    templateUrl: 'template/modal-confirm.html',
                    controller: 'ConfirmModalCtrl'
                });

                modalInstance.result.then(function (confirm) {
                    if (confirm) {
                        ResourceTeamService.removeMemberTeam($scope.team._id, $scope.member.user)
                            .then(function (response) {
                                $scope.listMembers.splice($scope.index, 1);
                                $scope.cancel();
                                $scope.showNotification('Member was removed ');

                            }, function (response) {
                                console.log(response);
                                $scope.showNotification(response.data.message, 'error');
                            });
                    }
                    modalInstance.close();
                });
            };

            $scope.cancel = function () {
                $modalInstance.dismiss('cancel');
                document.activeElement.blur();
            };
        }])

        .controller('membersCtrl', ['$scope', '$rootScope', 'toastr', '$modal', '$filter', '$stateParams', 'ResourceTeamService', 'configGlobal', function ($scope, $rootScope, toastr, $modal, $filter, $stateParams, ResourceTeamService, configGlobal) {

            $scope.hostname = configGlobal.getUrlApi();
            $scope.pattern = '';
            $scope.listMembers = [];
            $scope.pageMember = 1;
            $scope.checkLoadMoreMembers = true;

            $scope.listFilterSkills = [];
            $scope.listSkills = [];

            ResourceTeamService.getSkillsMembersTeam({slug: $stateParams.slug})
                .then(function (response) {
                    $scope.listSkills = response.data.skills;
                }, function (response) {
                    console.log(response);
                    $scope.showNotification(response.data.message, 'error');
                });

            $scope.addFilterSkill = function (id) {

                console.log(id);

                $scope.checkLoadMoreMembers = true;
                $scope.pageMember = 1;
                $scope.listMembers = [];
                $scope.pattern = '';

                var i = $scope.listFilterSkills.indexOf(id);
                if (i == -1) {
                    $scope.listFilterSkills.push(id);
                } else {
                    $scope.listFilterSkills.splice(i, 1);
                }

                if ($scope.listFilterSkills.length > 0) {
                    $scope.getMembersBySkills();
                } else {
                    $scope.loadMoreMembers();
                }
            };

            $scope.addFilterSkillMobile = function (id) {
                var i = $scope.listFilterSkills.indexOf(id);
                if (i == -1) {
                    $scope.listFilterSkills.push(id);
                } else {
                    $scope.listFilterSkills.splice(i, 1);
                }
            };

            $scope.restartParams = function () {
                $scope.checkLoadMoreMembers = true;
                $scope.pageMember = 1;
                $scope.listMembers = [];
                $scope.pattern = '';
            };

            $scope.cleanFilterWidget = function () {
                $scope.checkLoadMoreMembers = true;
                $scope.pageMember = 1;
                $scope.listMembers = [];
                $scope.pattern = '';
                $scope.listFilterSkills = [];
                $scope.loadMoreMembers();
            };

            $scope.loadMoreMembers = function () {
                if ($scope.checkLoadMoreMembers) {
                    if ($scope.listFilterSkills.length > 0) {
                        $scope.getMembersBySkills();
                    } else {
                        if (!$scope.pattern) {
                            ResourceTeamService.getMembersTeam({slug: $stateParams.slug, page: $scope.pageMember})
                                .then(function (response) {
                                    if (response.data.showing == 0) {
                                        $scope.checkLoadMoreMembers = false;
                                    } else {
                                        $scope.listMembers = $scope.listMembers.concat(response.data.members);
                                    }
                                }, function (response) {
                                    console.log(response);
                                    $scope.showNotification(response.data.message, 'error');
                                });
                            $scope.pageMember++;
                        } else {
                            searchMembersByPattern();
                        }
                    }
                }
            };

            $scope.$watch('pattern', function (tmpStr) {
                if ($scope.listMembers.length > 0) {
                    if (tmpStr === $scope.pattern) {
                        $scope.searchMembers(tmpStr);
                    }
                }
            });

            $scope.searchMembers = function (pattern) {
                $scope.pattern = pattern;
                $scope.checkLoadMoreMembers = true;
                $scope.pageMember = 1;
                $scope.listMembers = [];
                $scope.listFilterSkills = [];
                if ($scope.pattern) {
                    searchMembersByPattern();
                } else {
                    $scope.loadMoreMembers();
                }
            };

            function searchMembersByPattern() {
                if ($scope.checkLoadMoreMembers) {
                    ResourceTeamService.searchMembers({
                        slug: $stateParams.slug,
                        pattern: $scope.pattern,
                        page: $scope.pageMember
                    })
                        .then(function (response) {
                            if (response.data.showing == 0) {
                                $scope.checkLoadMoreMembers = false;
                            } else {
                                $scope.listMembers = $scope.listMembers.concat(response.data.members);
                            }
                        }, function (response) {
                            console.log(response);
                            $scope.showNotification(response.data.message, 'error');
                        });
                    $scope.pageMember++;
                }
            }

            $scope.getMembersBySkills = function () {
                ResourceTeamService.getMembersBySkills({
                    slug: $stateParams.slug,
                    page: $scope.pageMember,
                    skills: $scope.listFilterSkills
                })
                    .then(function (response) {
                        if (response.data.showing == 0) {
                            $scope.checkLoadMoreMembers = false;
                        } else {
                            $scope.listMembers = $scope.listMembers.concat(response.data.members);
                        }
                    }, function (response) {
                        console.log(response);
                        $scope.showNotification(response.data.message, 'error');
                    });
                $scope.pageMember++;
            };

            $scope.openModalFilter = function () {
                var modalInstance = $modal.open({
                    animation: true,
                    templateUrl: 'template/modal-filter-members.html',
                    controller: 'modalFilterCtrl',
                    windowClass: 'custom-modal-filter-panel right-left',
                    backdropClass: 'custom-modal-backdrop-filter-panel',
                    resolve: {
                        objectDataMember: function () {
                            return $scope;
                        }
                    }
                });
            };
        }])

        .controller('modalFilterCtrl', ['$scope', '$rootScope', 'toastr', '$modal', '$modalInstance', 'objectDataMember', function ($scope, $rootScope, toastr, $modal, $modalInstance, objectDataMember) {

            $scope.listMembers = objectDataMember.listMembers;
            $scope.listSkills = objectDataMember.listSkills;
            $scope.listFilterSkills = objectDataMember.listFilterSkills;
            $scope.addFilterSkillMobile = objectDataMember.addFilterSkillMobile;
            $scope.searchMembers = objectDataMember.searchMembers;
            $scope.loadMoreMembers = objectDataMember.loadMoreMembers;
            $scope.restartParams = objectDataMember.restartParams;
            $scope.searchpattern = objectDataMember.pattern;

            $scope.applySearchMembers = function () {
                $scope.restartParams();
                if ($('.search-pattern').val()) {
                    $scope.searchMembers($('.search-pattern').val());
                } else {
                    $scope.loadMoreMembers();
                }
                $scope.cancel();
            };

            $scope.cancel = function () {
                $modalInstance.dismiss('cancel');
                document.activeElement.blur();
            };
        }])

        .controller('modalMemberAddCtrl', ['$scope', '$rootScope', 'toastr', '$modal', '$modalInstance', function ($scope, $rootScope, toastr, $modal, $modalInstance) {
            $scope.cancel = function () {
                $modalInstance.dismiss('cancel');
                document.activeElement.blur();
            };
        }])

        .controller('headerCtrl', ['$scope', '$rootScope', 'toastr', '$modal', 'ResourceTeamService', '$stateParams', '$state', 'configGlobal', 'configGlobal', function ($scope, $rootScope, toastr, $modal, ResourceTeamService, $stateParams, $state, configGlobal) {

            var team = $stateParams.slug;
            $scope.hostname = configGlobal.getUrlApi();
            $scope.team = {};

            $scope.initialize = function () {
                ResourceTeamService.verifyTeam(team)
                    .then(function (response) {
                        $scope.team = response.data;
                    }, function (response) {
                        console.log(response);
                    });
            };

        }])

        .controller('pinboardCtrl', ['$scope', '$rootScope', 'toastr', '$modal', 'ResourceTeamService', '$stateParams', '$state', 'configGlobal', function ($scope, $rootScope, toastr, $modal, ResourceTeamService, $stateParams, $state, configGlobal) {

            $scope.hostname = configGlobal.getUrlApi();
            $scope.collections = [];
            $scope.listSkills = [];

            var slug = $stateParams.slug;

            $scope.openModalFilterPinboard = function () {
                var modalInstance = $modal.open({
                    animation: true,
                    templateUrl: 'template/modal-filter-pinboard.html',
                    controller: 'modalFilterPinboardCtrl',
                    windowClass: 'custom-modal-filter-panel right-left',
                    backdropClass: 'custom-modal-backdrop-filter-panel',
                    resolve: {}
                });
            };

            $scope.find = function () {

                ResourceTeamService.findCollectionTeam(slug)
                    .then(function (response) {

                        $scope.collections = [];

                        angular.forEach(response.data, function (collection) {

                            var isAdmin = $scope.team.isAdmin;
                            var user = String($scope.team.user);
                            var contributor = String(collection.contributor._id);

                            collection.type = 0;
                            collection.isRemove = false;


                            if (!collection.image) {
                                collection.image = $scope.imageRand();
                            }

                            if (collection.is_team) {
                                collection.contributor.name = collection.team.name;
                                collection.contributor.profile_pic = collection.team.logo;
                                collection.type = 1;
                            }

                            if (collection.for_team || !collection.is_team) {
                                if (isAdmin || contributor === user)
                                    collection.isRemove = true;
                            }

                            if (collection.for_feature) {
                                if (contributor === user)
                                    collection.isRemove = true;
                            }

                            $scope.collections.push(collection);
                        });

                    }, function (response) {
                        console.log(response);
                        $scope.showNotification(response.data.message, 'error');
                    });
            };

            $scope.remove = function (index, team, collection, type) {

                var data = {type: type};

                ResourceTeamService.removeCollectionTeam(team, collection, data)
                    .then(function (response) {

                        console.log(response);
                        $scope.collections.splice(index, 1);
                        $scope.showNotification('remove');

                    }, function (response) {
                        console.log(response);
                        $scope.showNotification(response.data.message, 'error');
                    });
            };

            $scope.itmes = [];
            $scope._isCheckedFeatured = false;
            $scope._isCheckedTeam = false;

            $scope._checkedCheckBox = function (type) {

                if (type == 'featured') {

                    $scope._isCheckedFeatured = !$scope._isCheckedFeatured;

                    if ($scope._isCheckedFeatured)
                        $scope.itmes.push(type);
                    else
                        $scope.itmes.splice(0, 1);

                } else if (type === 'team') {

                    $scope._isCheckedTeam = !$scope._isCheckedTeam;

                    if ($scope._isCheckedTeam)
                        $scope.itmes.push(type);
                    else
                        $scope.itmes.splice(1, 1);
                }

            };

            $scope.myFunc = function(a) {
                for(x in $scope.itmes){
                    console.log(x);
                }
            };

            $scope.getSkills = function () {
                ResourceTeamService.getSkillsMembersTeam({slug: $stateParams.slug})
                    .then(function (response) {
                        $scope.listSkills = response.data.skills;
                    }, function (response) {
                        console.log(response);
                        $scope.showNotification(response.data.message, 'error');
                    });
            };

            $scope.openModalPublishACollection = function (team) {

                var modalInstance = $modal.open({
                    animation: true,
                    templateUrl: 'template/modal-publish-to-collection.html',
                    controller: 'CollectionModalCtrl',
                    resolve: {
                        team: function () {
                            return team;
                        }
                    }
                });

                modalInstance.result.then(function () {
                    $scope.find();
                });
            };

            $scope.imageRand = function () {
                return "images/circle/" + Math.floor((Math.random() * 5) + 1) + ".jpg";
            };

        }])

        .controller('modalFilterPinboardCtrl', ['$scope', '$rootScope', 'toastr', '$modal', '$modalInstance', 'ResourceTeamService', '$stateParams', function ($scope, $rootScope, toastr, $modal, $modalInstance, ResourceTeamService, $stateParams) {

            $scope.cancel = function () {
                $modalInstance.dismiss('cancel');
                document.activeElement.blur();
            };
        }])

        .controller('CollectionModalCtrl', ['$rootScope', '$scope', '$modalInstance', 'ResourceTeamService', '$http', 'toastr', '$modal', '$stateParams', 'team', function ($rootScope, $scope, $modalInstance, ResourceTeamService, $http, toastr, $modal, $stateParams, team) {

            $scope.collections = [];

            $scope.find = function () {

                ResourceTeamService.getCollectionByUser()
                    .then(function (response) {

                        angular.forEach(response.data.collections, function (value) {
                            if (!value.image)
                                value.image = $scope.imageRand();
                            else
                                value.image = "url('" + value.image + "')";

                            $scope.collections.push(value);
                        });

                    }, function (response) {
                        console.log(response);
                        $scope.showNotification(response.data.message, 'error');
                    });
            };

            $scope.AddCollection = function (collection) {

                var team = $stateParams.slug;

                ResourceTeamService.collectionAPublish(team, collection)
                    .then(function (response) {

                        $modalInstance.close();
                        $scope.showNotification('add');

                    }, function (response) {
                        console.log(response);
                        $scope.showNotification(response.data.message, 'error');
                    });
            };

            $scope.openModalAddTeamACollection = function () {

                var modalInstance = $modal.open({
                    animation: true,
                    templateUrl: 'template/modal-add-team-collection.html',
                    controller: 'AddTeamCollectionModalCtrl',
                    resolve: {
                        team: function () {
                            return team;
                        }
                    }
                });

                modalInstance.result.then(function () {
                    $modalInstance.close();
                });
            };

            $scope.imageRand = function () {
                return "url(\'images/circle/" + Math.floor((Math.random() * 5) + 1) + ".jpg\')";
            };

            $scope.cancel = function () {
                $modalInstance.dismiss('cancel');
                document.activeElement.blur();
            };
        }])

        .controller('teamCollectionDetailCtrl', ['$scope', '$stateParams', 'configGlobal', '$modal', '$auth', 'ResourceTeamService', 'toastr', '$state', '$location', function ($scope, $stateParams, configGlobal, $modal, $auth, ResourceTeamService, toastr, $state, $location) {

            $scope.hostname = configGlobal.getUrlApi();
            $scope.listChapter = [];
            $scope.collection = {};
            $scope.contributors = [];
            $scope.team = {};

            var team = $stateParams.team;
            var slug = $stateParams.slug;

            $scope.initialize = function () {

                ResourceTeamService.verifyTeam(team)
                    .then(function (response) {
                        $scope.team = response.data;
                    }, function (response) {
                        $state.go('404');
                    });
            };

            ResourceTeamService.getTeamCollectionDetail(team, slug)
                .then(function (response) {

                    var id = response.data.collection._id;

                    ResourceTeamService.getCollectionDetail(id)
                        .then(function (response) {

                            jquery();
                            $scope.listChapter = [];

                            angular.forEach(response.data, function (collection) {

                                $scope.isUpdate = false;

                                var isAdmin = $scope.team.isAdmin;
                                var user = String($scope.team.user);
                                var creator = String(collection.contributor._id);


                                if (collection.is_team) {
                                    collection.contributor.name = collection.team.name;
                                    collection.contributor.profile_pic = collection.team.logo;
                                    $scope.contributors = collection.contributors;
                                }

                                if (collection.for_team || !collection.is_team) {
                                    if (isAdmin || creator === user) $scope.isUpdate = true;
                                }

                                if (collection.for_feature) {
                                    if (creator === user) $scope.isUpdate = true;
                                }

                                $scope.collection = collection;

                                angular.forEach(collection.resources, function (resource) {

                                    var contributor = String(resource.user);

                                    resource.isRemove = false;

                                    if (!collection.is_team) {
                                        if (user === contributor) resource.isRemove = true;
                                    }

                                    if (collection.for_team) {
                                        if (isAdmin || user === contributor) resource.isRemove = true;
                                    }

                                    if (collection.for_feature) {
                                        if (user === contributor) resource.isRemove = true;
                                    }

                                    $scope.listChapter.push(resource);
                                });
                            });
                        }, function (response) {
                            $state.go('404');
                        });

                }, function (response) {
                    $state.go('404');
                });

            $scope.backAllCollection = function (event) {
                event.preventDefault();
                window.history.back();
            };

            $scope.removeResource = function ($index, id, resource) {

                ResourceTeamService.removeResourcesCollection( id, resource)
                    .then(function (response) {
                        $scope.listChapter.splice($index, 1);
                        $scope.showNotification('Gone! Resource removed from collection.');
                    }, function (response) {
                        $scope.StStatusLoading = false;
                        $scope.showNotification(response.message, 'error');
                    });
            };

            var jquery = function () {
                $('.section-content-collection-detail').show();
                $('.pre-body, .body-content').show();
                $('.sk-spinner-pulse').hide();
            };

            $scope.openModalEditTeamACollection = function (collection) {

                var team = $scope.team;

                var modalInstance = $modal.open({
                    animation: true,
                    templateUrl: 'template/modal-edit-team-collection.html',
                    controller: 'EditTeamCollectionModalCtrl',
                    resolve: {
                        collection: function () {
                            return collection;
                        },
                        team: function () {
                            return team;
                        }
                    }
                });

                modalInstance.result.then(function () {
                });
            };

        }])

        .controller('AddTeamCollectionModalCtrl', ['$scope', '$rootScope', 'toastr', '$modal', '$modalInstance', 'ResourceTeamService', '$stateParams', 'configGlobal', 'team', '$q', function ($scope, $rootScope, toastr, $modal, $modalInstance, ResourceTeamService, $stateParams, configGlobal, team, $q) {

            $scope.team = team;
            $scope.collection = {};
            $scope.collection.for_team = true;

            $scope.store = function () {

                var data = $scope.collection;

                ResourceTeamService.storeCollectionTeam(team._id, data)
                    .then(function (response) {

                        $modalInstance.close();
                        $scope.showNotification('add');

                    }, function (response) {
                        console.log(response);
                        $scope.showNotification(response.data.message, 'error');
                    });
            };

            $scope.loadSkills = function ($query) {
                return loadSkills($query);
            };

            var loadSkills = function ($query) {
                var deferred = $q.defer();

                ResourceTeamService.loadSkills($query)
                    .success(function (response) {
                        deferred.resolve(response.circles);
                    }).error(function (response) {
                        $scope.StStatusLoading = false;
                        $scope.showNotification(response.message, 'error');
                    });
                return deferred.promise;
            };

            $scope.cancel = function () {
                $modalInstance.dismiss('cancel');
                document.activeElement.blur();
            };

        }])

        .controller('EditTeamCollectionModalCtrl', ['$scope', '$rootScope', 'toastr', '$modal', '$modalInstance', 'ResourceTeamService', '$stateParams', '$state', 'collection', 'team', '$q', function ($scope, $rootScope, toastr, $modal, $modalInstance, ResourceTeamService, $stateParams, $state, collection, team, $q) {

            $scope.collection = collection;
            //$scope.collection.for_team = true;

            $scope.update = function () {
                console.log(team);
                var data = $scope.collection;

                ResourceTeamService.updateCollectionTeam(team._id, data._id, data)
                    .then(function (response) {

                        $modalInstance.close();
                        $state.go('teamCollection',{team: team.slug, slug: response.data.slug});

                        $scope.showNotification('Updated');

                    }, function (response) {
                        console.log(response);
                        $scope.showNotification(response.data.message, 'error');
                    });
            };

            $scope.loadSkills = function ($query) {
                return loadSkills($query);
            };

            var loadSkills = function ($query) {
                var deferred = $q.defer();

                ResourceTeamService.loadSkills($query)
                    .success(function (response) {
                        deferred.resolve(response.circles);
                    }).error(function (response) {
                        $scope.StStatusLoading = false;
                        $scope.showNotification(response.message, 'error');
                    });
                return deferred.promise;
            };

            $scope.cancel = function () {
                $modalInstance.dismiss('cancel');
                document.activeElement.blur();
            };

        }])

        .controller('activityTeamCtrl', ['$scope', '$rootScope', 'toastr', '$modal', 'configGlobal', '$stateParams', '$state', function ($scope, $rootScope, toastr, $modal, configGlobal, $stateParams, $state) {

            $scope.hostname = configGlobal.getUrlApi();
            $scope.listMembers = [
                {
                    _id: '1111',
                    name: 'Gino Ferrand',
                    email: 'gino@teclalabs.com',
                    photo: 'gino.jpg'
                },
                {
                    _id: '2222',
                    name: 'John Smith',
                    email: 'john@teclalabs.com',
                    photo: 'gino.jpg'
                },
                {
                    _id: '1111',
                    name: 'Gino Ferrand',
                    email: 'gino@teclalabs.com',
                    photo: 'gino.jpg'
                },
                {
                    _id: '2222',
                    name: 'John Smith',
                    email: 'john@teclalabs.com',
                    photo: 'gino.jpg'
                }
            ];
        }]);

    
})();