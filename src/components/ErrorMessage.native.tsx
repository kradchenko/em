import { View } from 'moti'
import React from 'react'
import { StyleSheet, Text, TouchableOpacity } from 'react-native'
import { connect } from 'react-redux'
import Connected from '../@types/Connected'
import State from '../@types/State'
import error from '../action-creators/error'
import { fadeIn } from '../style/animations'
import { commonStyles } from '../style/commonStyles'

const { flexEnd, whiteText, centerText, redBackground } = commonStyles
const { from, animate } = fadeIn

// eslint-disable-next-line jsdoc/require-jsdoc
const mapStateToProps = ({ error }: State) => ({ value: error })

/** An error message that can be dismissed with a close button. */
const ErrorMessage = ({ value, dispatch }: Connected<{ value?: any }>) =>
  value ? (
    <View style={[styles.container, redBackground]} from={from} animate={animate} transition={{ type: 'timing' }}>
      <TouchableOpacity style={flexEnd} onPress={() => dispatch(error({ value: null }))}>
        <Text style={whiteText}>x</Text>
      </TouchableOpacity>

      <Text style={[centerText, whiteText]}>{value?.toString()}</Text>
    </View>
  ) : null

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    width: '100%',
    opacity: 0.4,
    zIndex: 1000,
    padding: 10,
  },
})

export default connect(mapStateToProps)(ErrorMessage)
