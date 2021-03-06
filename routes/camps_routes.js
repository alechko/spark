const userRole = require('../libs/user_role');
const constants = require('../models/constants.js');
var Camp = require('../models/camp').Camp;

// var User = require('../models/user').User;
var __camp_data_to_json = function (camp) {
    let camp_data = camp.toJSON();
    let camp_check_null = [
        'type', 'status', 'public_activity_area_desc', 'camp_activity_time', 'location_comments',
        'camp_location_street', 'camp_location_street_time', 'camp_location_area', 'contact_person_name',
        'contact_person_email', 'contact_person_phone'];
    for (let i in camp_check_null) {
        if (camp_data[camp_check_null[i]] === null) {
            camp_data[camp_check_null[i]] = '';
        }
    }
    return camp_data;
}
var __render_camp = function (camp, req, res) {
    var camp_id;
    if (['int', 'string'].indexOf(typeof camp) > -1) {
        camp_id = parseInt(camp);
    } else {
        camp_id = camp.id;
    }
    Camp.forge({
        id: camp_id,
        event_id: constants.CURRENT_EVENT_ID,
        __prototype: constants.prototype_camps.THEME_CAMP.id,
    }).fetch({}).then((camp) => {
        camp.getCampUsers((users) => {
            camp.init_t(req.t);
            // if user is camp_member, we can show all
            // let _user = camp.isUserCampMember(req.user.id);
            let camp_data = __camp_data_to_json(camp);
            let data = {
                user: req.user, //
                userLoggedIn: req.user.hasRole('logged in'), //
                id: camp_id, //
                camp: camp_data,
                breadcrumbs: req.breadcrumbs(),
                details: camp_data,
                isUserCampMember: (camp.isUserCampMember(req.user.id) || req.user.isAdmin),
                isUserInCamp: (camp.isUserInCamp(req.user.id) || req.user.isAdmin),
                isCampManager: (camp.isCampManager(req.user.id) || req.user.isAdmin),
                main_contact: camp.isUserInCamp(camp.attributes.main_contact),
                moop_contact: camp.isUserInCamp(camp.attributes.moop_contact),
                safety_contact: camp.isUserInCamp(camp.attributes.safety_contact),
            };
            res.render('pages/camps/camp', data);

        }, req.t);
    }).catch((e) => {
        res.status(500).json({
            error: true,
            data: {
                message: e.message
            }
        });
    });
}

module.exports = function (app, passport) {
    // ==============
    // Camps Routing
    // ==============
    // camps index page, create new camp
    app.get('/:lng/camps', userRole.isLoggedIn(), (req, res) => {
        req.breadcrumbs([{
            name: 'breadcrumbs.home',
            url: '/' + req.params.lng + '/home'
        },
        {
            name: 'camps:breadcrumbs.join_camp',
            url: '/' + req.params.lng + '/camps'
        }]);
        req.user.getUserCamps((camps) => {
            if (camps.length === 0 || !req.user.attributes.camp || !req.user.attributes.camp_manager) {
                // if (req.user.attributes.camps.length === 0 || !req.user.attributes.camp_manager) {
                camp = req.user.attributes.camp;
                res.render('pages/camps/index_user', {
                    user: req.user,
                    camp: camp,
                    breadcrumbs: req.breadcrumbs()
                });
            } else {
                __render_camp(req.user.attributes.camp, req, res);
            }
        }, req.t);
    });
    // Read
    app.get('/:lng/camps/:id', userRole.isLoggedIn(), (req, res) => {
        req.breadcrumbs([{
            name: 'breadcrumbs.home',
            url: '/' + req.params.lng + '/home'
        },
        {
            name: 'camps:breadcrumbs.my_camp',
            url: '/' + req.params.lng + '/camps'
        },
        {
            name: 'camps:breadcrumbs.camp_stat',
            url: '/' + req.params.lng + '/camps/' + req.params.id
        }]);
        __render_camp(req.params.id, req, res);
    });
    // new camp
    app.get('/:lng/camps/new', userRole.isAdmin(), (req, res) => {
        req.breadcrumbs([{
            name: 'breadcrumbs.home',
            url: '/' + req.params.lng + '/home'
        },
        {
            name: 'camps:breadcrumbs.manage',
            url: '/' + req.params.lng + '/camps-admin'
        },
        {
            name: 'camps:breadcrumbs.new',
            url: '/' + req.params.lng + '/camps/new/?c=' + req.query.c
        }]);

        let prototype = constants.prototype_camps.THEME_CAMP.id;
        let result = Camp.prototype.__parsePrototype(prototype, req.user);
        res.render('pages/camps/edit', {
            user: req.user,
            camp_name_en: req.query.c,
            breadcrumbs: req.breadcrumbs(),
            camp: { type: '', id: 'new' },
            details: {},
            isAdmin: result.isAdmin,
            isNew: true,
            __groups_prototype: prototype,
            t_prefix: result.t_prefix,
            isArt: prototype === constants.prototype_camps.ART_INSTALLATION.id,
            isCamp: prototype === constants.prototype_camps.THEME_CAMP.id,
            isProd: prototype === constants.prototype_camps.PROD_DEP.id,
        });
    });
    // Edit
    app.get('/:lng/camps/:id/edit', userRole.isLoggedIn(), (req, res) => {
        req.breadcrumbs([{
            name: 'breadcrumbs.home',
            url: '/' + req.params.lng + '/home'
        },
        {
            name: 'camps:breadcrumbs.manage',
            url: '/' + req.params.lng + '/camps-admin'
        },
        {
            name: 'camps:breadcrumbs.edit',
            url: '/' + req.params.lng + '/camps/' + req.params.id + '/edit'
        }]);
        Camp.forge({
            id: req.params.id,
            // event_id: constants.CURRENT_EVENT_ID,
        })/*.related('users_groups')*/.fetch({
            withRelated: ['users_groups']
        }).then((camp) => {
            let group_props = camp.parsePrototype(req.user);
            req.user.getUserCamps((camps) => {
                // let __groups_prototype='';
                if (req.user.isManagerOfCamp(req.params.id) || group_props.isAdmin) {
                    let camp_data = __camp_data_to_json(camp);
                    if (camp_data.addinfo_json !== null) {
                        camp_data.addinfo_json = JSON.parse(camp_data.addinfo_json);
                    }
                    camp_data.entrance_quota = camp.relations.users_groups.attributes.entrance_quota;
                    let _edit_rec = {
                        user: req.user,
                        breadcrumbs: req.breadcrumbs(),
                        camp: camp_data,
                        details: camp_data,
                        isNew: false,
                        isAdmin: group_props.isAdmin,
                        __groups_prototype: camp.attributes.__prototype,
                        t_prefix: group_props.t_prefix,
                        isArt: camp.attributes.__prototype === constants.prototype_camps.ART_INSTALLATION.id,
                        isCamp: camp.attributes.__prototype === constants.prototype_camps.THEME_CAMP.id,
                        isProd: camp.attributes.__prototype === constants.prototype_camps.PROD_DEP.id,
                    }
                    res.render('pages/camps/edit', _edit_rec);
                } else {
                    res.status(500).json({
                        error: true,
                        data: {
                            message: 'failed to edit camp'
                        }
                    });
                }
            },req,group_props.id);
        })
    });
    // camps statistics
    app.get('/:lng/camps-stats', userRole.isLoggedIn(), (req, res) => {
        req.breadcrumbs([{
            name: 'breadcrumbs.home',
            url: '/' + req.params.lng + '/home'
        },
        {
            name: 'camps:breadcrumbs.manage',
            url: '/' + req.params.lng + '/camps-admin'
        },
        {
            name: 'camps:breadcrumbs.stats',
            url: '/' + req.params.lng + '/camps-stats'
        }]);
        res.render('pages/camps/stats', {
            user: req.user,
            breadcrumbs: req.breadcrumbs()
        });
    });
    // camps members board
    app.get('/:lng/camps-members', userRole.isLoggedIn(), (req, res) => {
        req.breadcrumbs([{
            name: 'breadcrumbs.home',
            url: '/' + req.params.lng + '/home'
        },
        {
            name: 'camps:breadcrumbs.manage',
            url: '/' + req.params.lng + '/camps-admin'
        },
        {
            name: 'camps:breadcrumbs.members',
            url: '/' + req.params.lng + '/camps-members'
        }]);
        res.render('pages/camps/members', {
            user: req.user,
            breadcrumbs: req.breadcrumbs()
        });
    });
    // camps documents
    app.get('/:lng/camps-docs', userRole.isLoggedIn(), (req, res) => {
        req.breadcrumbs([{
            name: 'breadcrumbs.home',
            url: '/' + req.params.lng + '/home'
        },
        {
            name: 'camps:breadcrumbs.manage',
            url: '/' + req.params.lng + '/camps-admin'
        },
        {
            name: 'camps:breadcrumbs.docs',
            url: '/' + req.params.lng + '/camps-docs'
        }]);
        res.render('pages/camps/docs', {
            user: req.user,
            breadcrumbs: req.breadcrumbs()
        });
    });
    // camps admin management panel
    app.get('/:lng/camps-admin/:cardId*?', userRole.isLoggedIn(), (req, res) => {
        req.breadcrumbs([{
            name: 'breadcrumbs.home',
            url: '/' + req.params.lng + '/home'
        },
        {
            name: 'camps:breadcrumbs.manage',
            url: '/' + req.params.lng + '/camps-admin'
        }]);
        if (req.user.isAdmin || req.user.isCampsAdmin) {
            res.render('pages/camps/index_admin', {
                user: req.user,
                breadcrumbs: req.breadcrumbs(),
                __groups_prototype: 'theme_camps',
                t_prefix: 'camps:',
                isCamp: true,
            });
        } else {
            // user not admin
            res.render('pages/camps/index_user', {
                user: req.user,
                breadcrumbs: req.breadcrumbs()
            });
        }
    });

    // art admin management panel
    app.get('/:lng/art-admin/:cardId*?', userRole.isLoggedIn(), (req, res) => {
        req.breadcrumbs([{
            name: 'breadcrumbs.home',
            url: '/' + req.params.lng + '/home'
        },
        {
            name: 'camps:breadcrumbs.manage',
            url: '/' + req.params.lng + '/art-admin'
        }]);
        if (req.user.isAdmin || req.user.isArtInstallationsAdmin) {
            res.render('pages/camps/index_admin', {
                user: req.user,
                breadcrumbs: req.breadcrumbs(),
                __groups_prototype: 'art_installation',
                t_prefix: 'camps:art_installation.',
                isArt: true,
            });
        } else {
            // user not admin
            res.render('pages/camps/index_user', {
                user: req.user,
                breadcrumbs: req.breadcrumbs()
            });
        }
    });
    // art admin management panel
    app.get('/:lng/prod-admin/:cardId*?', userRole.isLoggedIn(), (req, res) => {
        req.breadcrumbs([{
            name: 'breadcrumbs.home',
            url: '/' + req.params.lng + '/home'
        },
        {
            name: 'camps:breadcrumbs.manage',
            url: '/' + req.params.lng + '/prod-admin'
        }]);
        if (req.user.isAdmin || req.user.isProdDepsAdmin) {
            res.render('pages/camps/index_admin', {
                user: req.user,
                breadcrumbs: req.breadcrumbs(),
                __groups_prototype: 'prod_dep',
                t_prefix: 'camps:prod_dep.',
                isProd: true,

            });
        } else {
            // user not admin
            res.render('pages/camps/index_user', {
                user: req.user,
                breadcrumbs: req.breadcrumbs()
            });
        }
    });

    // Program
    app.get('/:lng/program', userRole.isLoggedIn(), (req, res) => {
        req.breadcrumbs('camps-new_program');
        res.render('pages/camps/program', {
            user: req.user,
            camp_name_en: req.query.c
        });
    });
};
