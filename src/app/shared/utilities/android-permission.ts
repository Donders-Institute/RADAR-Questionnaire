import 'rxjs/add/operator/map'

import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { AndroidPermissions } from '@ionic-native/android-permissions/ngx'
import { Device } from '@ionic-native/device/ngx'

import { Utility } from './util'

declare var cordova: any

@Injectable()
export class AndroidPermissionUtility {
  util: any
  permissionState: any
  permissionGrantedList = []
  permissionDeniedList = []
  permissionCheckedCount: number = 0

  // TODO: Add on load required permissions to this list
  // NOTE: Run time permissions need be to asked individually wherever required by using the below methods
  androidPermissionList: string[] = [
    this.androidPermissions.PERMISSION.RECORD_AUDIO,
    this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE
  ]

  constructor(
    private http: HttpClient,
    private device: Device,
    private utility: Utility,
    private androidPermissions: AndroidPermissions
  ) {}

  AuthorizePermissions() {
    // NOTE: Device.platform holds both platforms, ios and android, currently permissions are taken only on android
    // TODO: Incase "IOS" add respective permission

    this.androidPermissions.requestPermissions(this.androidPermissionList).then(
      success => {
        console.log(success)
        this.checkPermissions()
      },
      error => {
        console.log(error)
      }
    )
  }

  checkPermissions(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.permissionGrantedList = []
      this.permissionDeniedList = []

      this.androidPermissionList.forEach(permission => {
        this.androidPermissions.checkPermission(permission).then(
          success => {
            console.log('count:' + this.permissionCheckedCount)
            if (success.hasPermission === true) {
              this.permissionGrantedList.push(permission)
            } else {
              this.permissionDeniedList.push(permission)
            }
          },
          err => {
            reject(err)
            console.log(err)
          }
        )
      })
      resolve(true)
    })
  }

  getPermissionStatus() {
    if (this.permissionDeniedList.length === 0) {
      return true
    } else {
      return false
    }
  }

  // NOTE: Returns a promise with an object containing "hasPermission" boolean value
  fetchPermission(permission): Promise<any> {
    return new Promise((resolve, reject) => {
      this.androidPermissions.requestPermission(permission).then(
        res => {
          this.checkPermission(permission).then(
            success => {
              resolve(success)
            },
            error => {
              reject(error)
            }
          )
        },
        error => {
          console.log(error)
          reject(error)
        }
      )
    })
  }

  checkPermission(permission): Promise<any> {
    return new Promise((resolve, reject) => {
      this.androidPermissions.checkPermission(permission).then(
        success => {
          if (success.hasPermission === true) {
            resolve(true)
          } else {
            reject(false)
          }
        },
        error => {
          reject(error)
        }
      )
    })
  }

  // NOTE: For Run time permissions use these below methods at the required pages

  getCamera_Permission() {
    return this.fetchPermission(this.androidPermissions.PERMISSION.CAMERA)
  }

  getRecordAudio_Permission() {
    return this.fetchPermission(this.androidPermissions.PERMISSION.RECORD_AUDIO)
  }

  getWriteExternalStorage_permission() {
    return this.fetchPermission(
      this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE
    )
  }

  // TODO: Add required permissions as above
}
