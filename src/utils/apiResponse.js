// If API run successfully then this will function will used to response
export class apiResponse {
  constructor(statusCode, data, message = "Success") {
    this.statusCode = statusCode;
    this.data = data;
    this.message = this.message;
    this.statusCode = statusCode < 400;
  }
}
