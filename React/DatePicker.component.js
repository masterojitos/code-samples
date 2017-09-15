import React, {Component, PropTypes} from 'react';
import moment from 'moment';

var updated = false;

class DatePicker extends Component {
  constructor(props, context) {
    super(props, context);
    this.state = {
      allDay: false,
      start_date: null,
      end_date: null,
    };
    this.onChangeStartDate = this.onChangeStartDate.bind(this);
    this.onChangeEndDate = this.onChangeEndDate.bind(this);
  }

  onChangeStartDate(t, $i) {
    var ct = moment(t);
    let {position, handleDates, date} = this.props;
    let {allDay} = this.state;
    let payload = Object.assign({}, date, {allDay});
    payload.start_date = ct;
    if (allDay) {
      payload.end_date = null;
    }
    this.setState(payload);
    handleDates('SET', position, payload);
  }

  onChangeEndDate(ct, $i) {
    ct = moment(ct);
    let {position, handleDates, date} = this.props;
    let {allDay} = this.state;
    let payload = Object.assign({}, date, {allDay});
    payload.end_date = ct;
    handleDates('SET', position, payload);
    this.setState(payload);
  }

  componentDidUpdate() {
    let {canDelete, last, handleDates, position, startDate, endDate, allDay} = this.props;
    let id_s = `date-${position}-s`;
    let id_e = `date-${position}-e`;
    let {start_date} = this.state;

    let startDateMinimum = new Date();
    startDateMinimum.setDate(startDateMinimum.getDate() + 4);
    startDateMinimum.setHours(0);
    startDateMinimum.setMinutes(0);
    startDateMinimum.setSeconds(0);

    let settings = {
      onChangeDateTime: this.onChangeEndDate,
      format: 'Y-m-d H:i'
    };

    let payload = {};
    if (startDate) {
      let startDateRound = new Date(moment(startDate));
      startDateRound.setMinutes(startDateRound.getMinutes() + 30);
      startDateRound.setMinutes(0);
      $(`#${id_s}`).val(moment(startDateRound).format('YYYY-MM-DD HH:mm'));
      payload.start_date = moment(startDateRound);
    }
    if (allDay) {
      $('#allday-' + position).prop('checked', true);
      payload.allDay = true;
      payload.end_date = null;
    } else if (endDate) {
      let endDateRound = new Date(moment(endDate));
      endDateRound.setMinutes(endDateRound.getMinutes() + 30);
      endDateRound.setMinutes(0);
      $(`#${id_e}`).val(moment(endDateRound).format('YYYY-MM-DD HH:mm'));
      payload.allDay = false;
      payload.end_date = moment(endDateRound);
    } else if (allDay === false) {
      $('#allday-' + position).prop('checked', false);
      payload.allDay = false;
    }
    if ((payload.start_date && payload.start_date !== this.state.start_date) || 
      (payload.end_date && payload.end_date !== this.state.end_date) || 
      (payload.allDay !== undefined && payload.allDay !== this.state.allDay)) {
      this.setState(payload);
      //handleDates('SET', position, payload);
    }

    let startDateFormMinimum = new Date(start_date);
    if (start_date && startDateFormMinimum <= startDateMinimum) {
      start_date = null;
      $(`#${id_s}`).val('');
      this.setState({start_date:null});
      handleDates('SET', position, payload);
    }

    if (start_date) {
      let start_date_string = start_date.format('YYYY-MM-DD');
      settings.minDate = start_date.format('YYYY-MM-DD HH:mm');

      let end_date = $(`#${id_e}`).val();
      let end_date_string = moment(end_date).format('YYYY-MM-DD');
      if (end_date == '') settings.startDate = start_date_string;
      else if (start_date_string > end_date_string) $(`#${id_e}`).val('');
      else settings.startDate = null;

      let times = [];
      let start_day = start_date.format('DD');
      let end_day = end_date != '' ? moment(end_date).format('DD') : start_date.format('DD');
      let startDateRound = new Date(start_date);
      startDateRound.setMinutes(startDateRound.getMinutes() + 30);
      startDateRound.setMinutes(0);
      let start_time = end_date == '' || start_date_string == end_date_string ? parseInt(moment(startDateRound).format('H')) + 1 : 0;
      for (var i = start_time; i < 24; i++) {
        times.push((i < 10 ? '0' : '') + i + ':00');
      }
      settings.allowTimes = times;

      if (start_date_string == end_date_string && parseInt(start_date.format('H')) > parseInt(moment(end_date).format('H'))) {
        $(`#${id_e}`).val('');
      }
    }
    $(`#${id_e}`).datetimepicker(settings);
  };

  componentDidMount() {
    let {canDelete, last, handleDates, position, startDate, endDate, allDay} = this.props;
    let id_s = `date-${position}-s`;
    let id_e = `date-${position}-e`;

    let startDateMinimum = new Date();
    startDateMinimum.setDate(startDateMinimum.getDate() + 4);
    startDateMinimum.setHours(0);
    startDateMinimum.setMinutes(0);
    startDateMinimum.setSeconds(0);

    let settings = {
      minDate: moment(startDateMinimum).format('YYYY-MM-DD HH:mm'),
      onChangeDateTime: this.onChangeStartDate,
      format: 'Y-m-d H:i'
    };

    let payload = {};
    if (startDate) {
      let startDateRound = new Date(startDate);
      startDateRound.setMinutes(startDateRound.getMinutes() + 30);
      startDateRound.setMinutes(0);
      let startDatePropMinimum = new Date(startDate);
      if (startDatePropMinimum > startDateMinimum) {
        $(`#${id_s}`).val(moment(startDateRound).format('YYYY-MM-DD HH:mm'));
        payload.start_date = moment(startDateRound);
      }
    }
    if (allDay) {
      $('#allday-' + position).prop('checked', true);
      payload.allDay = true;
      payload.end_date = null;
    } else if (endDate) {
      let endDateRound = new Date(endDate);
      endDateRound.setMinutes(endDateRound.getMinutes() + 30);
      endDateRound.setMinutes(0);
      let endDatePropMinimum = new Date(endDate);
      if (endDatePropMinimum > startDateMinimum) {
        $(`#${id_e}`).val(moment(endDateRound).format('YYYY-MM-DD HH:mm'));
        payload.allDay = false;
        payload.end_date = moment(endDateRound);
      }
    }
    if ((payload.start_date && payload.start_date !== this.state.start_date) || 
      (payload.end_date && payload.end_date !== this.state.end_date) || 
      (payload.allDay !== undefined && payload.allDay !== this.state.allDay)) {
      this.setState(payload);
      handleDates('SET', position, payload);
    }

    $(`#${id_s}`).datetimepicker(settings);
  };

  render() {
    let {canDelete, last, handleDates, position} = this.props;

    let {allDay} = this.state;
    let id_all_day = `allday-${position}`;
    let id_s = `date-${position}-s`;
    let id_e = `date-${position}-e`;

    /*
     <div className="col-md-1">
     <div className="hold">
     <label>&nbsp;</label>

     {last ? (<span onClick={e => handleDates('ADD')}><i className="fa fa-plus"></i></span>) : null}
     <input

     className="form-control" type="checkbox"/>

     </div>
     </div>
     */
    return (
      <div className="row">


        <div className="col-md-1 form-align-height">
          <input
            type="checkbox"
            onChange={(e)=> {
              this.setState({
                allDay: !allDay
              })
              let {position, handleDates, date} = this.props;
              let {allDay} = this.state;
              let payload = Object.assign({}, date, {   allDay: !allDay});
              if (!allDay) {
                payload.end_date = null;
              }
              this.setState(payload);
              handleDates('SET', position, payload);
              // $('.checkbox_allday').each(function() {
              //   if ($(this).attr('id') !== 'allday-' + position) {
              //     $(this).prop('checked', !allDay);
              //     $(this).trigger('click');
              //   }
              // });
            }}
            id={id_all_day} className="checkbox_allday"
            defaultChecked={allDay}/>
        </div>


        <div className="col-md-5">
          <div className="hold">

            <div id="datepicker-main-1" className="input-group date" data-date-format="mm-dd-yyyy">
              <input
                ref="start_date"
                className="form-control" id={id_s} type="text"/>
              <label htmlFor={id_s} className="input-group-addon"><i className="icon-drop"></i></label>
            </div>
          </div>
        </div>

        <div className="col-md-5">
          {!this.state.allDay ? (
            <div className="hold">
              <div id="datepicker-main-2" className="input-group date" data-date-format="mm-dd-yyyy">
                <input

                  ref="end_date"
                  className="form-control" id={id_e} type="text"/>
                <label htmlFor={id_e} className="input-group-addon"><i className="icon-drop"></i></label>
              </div>
            </div>
          ) : null}
        </div>


        <div className="col-md-1 form-align-height">
          {canDelete ? (
            <a onClick={e => {e.preventDefault();handleDates('DELETE', position)}} href="#"><i
              className="fa fa-close"></i></a>
          ) : null}

        </div>


      </div>
    )
  }
}


DatePicker.propTypes = {
  position: PropTypes.number.isRequired,
  date: PropTypes.object.isRequired,
  startDate: PropTypes.string,
  endDate: PropTypes.string,
  // allDay: PropTypes.bool.isRequired,
  canDelete: PropTypes.bool.isRequired,
  first: PropTypes.bool,
  last: PropTypes.bool.isRequired,
  handleDates: PropTypes.func.isRequired,
};

export default DatePicker;