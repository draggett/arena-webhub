# ECG demo



This uses data from physio.net's extensive database. I have reduce the sample rate to 100 Hz to make the data set manageable in a web browser.



The server app needs to check the time since the last data was sent to compute how many samples to send. The latency is the interval at which the server sends blocks of samples. The client creates an array for each channel with a length matching the width of the canvas. Every time step, the client shifts the first sample off the array and redraws the channel. New data is appended to the end of the array.

How can I make use of thing descriptions here?

I could download the thing description and use it to initialise the time constants.