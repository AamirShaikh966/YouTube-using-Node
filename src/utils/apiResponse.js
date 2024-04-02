class apiResponse {
  constructor(statusCode, data, message = "Success") {
    this.statusCode = statusCode;
    this.data = data;
    this.message = this.message;
    this.statusCode = statusCode < 400;
  }
}
