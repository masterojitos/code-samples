import React, {Component, PropTypes} from 'react';
import {getSignedURL_image} from '../../../../services/s3';
import ReactS3Uploader from 'react-s3-uploader';
// https://github.com/jamesssooi/Croppr.js

class CropPhoto extends Component {
  constructor(props, context) {
    super(props, context);
    this.state = {
      fileTmp: null,
      s3callback: null,
      photoTmp: null,
      cropInstance: null
    };
    this.maxSize = 5; //MB
    this.maxSizetoUpload = 2; //MB
    this.minWidth = props.width ? parseInt(props.width) : 700; //966 //483
    this.minHeight = props.height ? parseInt(props.height) : 800; //1104 //552
    this.onChangePhoto = this.onChangePhoto.bind(this);
    this.getImagePortion = this.getImagePortion.bind(this);
    this.uploadPhoto = this.uploadPhoto.bind(this);
    this.dataURLtoFile = this.dataURLtoFile.bind(this);
  }

  onChangePhoto(file, callback) {
    let reader = new FileReader();
    let self = this;
    if (self.state.cropInstance) {
      $('#crop_photo img, #crop_photo .croppr-container').remove();
    }
    reader.onloadend = () => {
      let img = new Image();
      img.src = reader.result;
      img.onload = function () {
        if ('image/jpeg,image/gif,image/png'.indexOf(file.type) < 0) {
          alert('Invalid file type.');
        } else if (file.size > (self.maxSize * 1024 * 1024)) {
          alert('The maximum file size is ' + self.maxSize + 'MB.');
        } else if (img.width < self.minWidth || img.height < self.minHeight) {
          alert('Tour photo must be at least ' + self.minWidth + ' by ' + self.minHeight + ' pixels.')
        } else if (img.width > self.minWidth || img.height > self.minHeight) {
          $('#crop_photo .modal-body').append(img);
          if (self.props.inside) $('#crop_photo').show();
          else $('#crop_photo').modal('toggle');
          let cropInstance = new Croppr('#crop_photo img', {
            aspectRatio: self.minWidth > self.minHeight ? self.minWidth / self.minHeight : self.minHeight / self.minWidth,
            // minSize: [self.minWidth, self.minHeight],
            // maxSize: [self.minWidth * 2, self.minHeight * 2],
            // startSize: [50, 50]
          });
          self.setState({fileTmp: file, s3callback: callback, photoTmp: img, cropInstance: cropInstance}); 
        } else {
          getSignedURL_image(file, callback);
        }
      };
    }
    reader.readAsDataURL(file);
    $('#tripeus_cropPhoto').val('');
  }

  getImagePortion (imgObj, mimetype, newWidth, newHeight, startX, startY, ratio) {
    let canvas = document.createElement('canvas');
    let canvasContext = canvas.getContext('2d');
    canvas.width = newWidth; canvas.height = newHeight;
    let bufferCanvas = document.createElement('canvas');
    let bufferContext = bufferCanvas.getContext('2d');
    bufferCanvas.width = imgObj.width;
    bufferCanvas.height = imgObj.height;
    bufferContext.drawImage(imgObj, 0, 0);
    canvasContext.drawImage(bufferCanvas, startX, startY, newWidth * ratio, newHeight * ratio, 0, 0, newWidth, newHeight);
    return canvas.toDataURL(mimetype);
  }

  dataURLtoFile (dataurl, filename) {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1], 
    bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, {type:mime});
  }

  uploadPhoto (e) {
    e.preventDefault();
    let {fileTmp, s3callback, photoTmp} = this.state;
    let {x, y, width, height} = this.state.cropInstance.getValue();
    if (width <= 0 || height <= 0) {
      alert('You must select a crop area.');
    } else if (width < this.minWidth || height < this.minHeight) {
      alert('You must select a larger crop area.');
    } else {
      let newImgData = this.getImagePortion(photoTmp, fileTmp.type, width, height, x, y, 1);
      let newImgFile = this.dataURLtoFile(newImgData, fileTmp.name);
      if (newImgFile.size > (this.maxSizetoUpload * 1024 * 1024)) {
        alert('You must select a smaller crop area.');
      } else {
        if (this.props.inside) $('#crop_photo').hide();
        else $('#crop_photo').modal('toggle');
        $('#crop_photo img, #crop_photo .croppr-container').remove();
        getSignedURL_image(newImgFile, s3callback, true);
      }
    }
  }

  render() {
    let {submit, inside} = this.props;
    return (
      <div>
        <ReactS3Uploader
          getSignedUrl={this.onChangePhoto}
          id="tripeus_cropPhoto"
          style={{display: this.props.hide ? "none" : "block"}}
          accept="image/*"
          onProgress={(progress)=>{
            if (progress > 0) {
              $('#tripeus_progressbar').show().find('span').css('width', progress + '%');
              if (submit) $(submit).attr('disabled', true);
            }
          }}
          onError={(e)=>{
            alert('Couldn\'t upload image. Please, try again with another image or try later.')
            $('#tripeus_progressbar span').animate({width:0}, 1000, function() { $('#tripeus_progressbar').fadeOut(); });
            if (submit) $(submit).attr('disabled', false);
          }}
          onFinish={(response)=>{
            this.props.handlePhotos(response.publicUrl);
            $('#tripeus_progressbar span').css('width', '100%')
              .fadeOut().fadeIn().fadeOut().fadeIn()
              .animate({width:0}, 1000, function() { $('#tripeus_progressbar').fadeOut(); });
            if (submit) $(submit).attr('disabled', false);
          }}
          uploadRequestHeaders={{'x-amz-acl': 'public-read'}}
          contentDisposition="auto"
          data-jcf="{'checkedClass': 'test', 'wrapNative': false}"
          data-text="Select some pictures"/>

        {!inside && !this.props.hide ? (
          <span>To ensure the best quality, we recommend that you upload images with a resolution of at least {this.minWidth} by {this.minHeight} pixels.</span>
        ) : null}

        {inside ? (
        <div id="crop_photo" className="crop-photo">
          <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title" id="myModalLabel">Crop Picture</h4>
              </div>
              <div className="modal-body"></div>
              <div className="modal-footer">
                <button type="submit" className="btn btn-info-sub btn-md" onClick={this.uploadPhoto}>Upload Picture</button>
              </div>
          </div>
        </div>
        ) : (
        <div className="modal fade" id="crop_photo" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" data-backdrop="static">
          <div className="modal-dialog" role="document">
            <div className="modal-content">
                <div className="modal-header">
                  <button type="button" className="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                  </button>
                  <h4 className="modal-title" id="myModalLabel">Crop Picture</h4>
                </div>
                <div className="modal-body"></div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-info-sub btn-md" onClick={this.uploadPhoto}>Upload Picture</button>
                </div>
            </div>
          </div>
        </div>
        )}

        <div id="tripeus_progressbar"><span></span></div>
      </div>
    )
  }
}

CropPhoto.propTypes = {
  submit: PropTypes.string,
  width: PropTypes.string,
  height: PropTypes.string,
  inside: PropTypes.bool
};

export default CropPhoto;